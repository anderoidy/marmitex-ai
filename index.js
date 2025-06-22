// Bot Inteligente para Marmitex (SEM necessidade de OpenAI)
// Dependências: npm install whatsapp-web.js node-cron

const { Client, LocalAuth } = require('whatsapp-web.js');
const cron = require('node-cron');
const qrcode = require('qrcode-terminal');

// Base de dados em memória
const customerData = new Map();
const activeOrders = new Map(); // Pedidos em andamento

const menuData = {
    marmitas: [
        { id: 1, nome: 'Tradicional', preco: 15.00, desc: 'Arroz, feijão, bife, batata frita, salada' },
        { id: 2, nome: 'Frango', preco: 14.00, desc: 'Arroz, feijão, frango grelhado, batata doce, salada' },
        { id: 3, nome: 'Vegana', preco: 13.00, desc: 'Arroz integral, feijão, proteína de soja, legumes' },
        { id: 4, nome: 'Fitness', preco: 16.00, desc: 'Arroz integral, feijão preto, frango, brócolis' },
        { id: 5, nome: 'do Chefe', preco: 18.00, desc: 'Arroz, feijão tropeiro, picanha, mandioca' }
    ],
    bebidas: [
        { id: 6, nome: 'Refrigerante', preco: 4.00 },
        { id: 7, nome: 'Suco Natural', preco: 5.00 },
        { id: 8, nome: 'Água', preco: 2.00 }
    ]
};

// Estados da conversa
const STATES = {
    INICIO: 'inicio',
    ESCOLHENDO_MARMITA: 'escolhendo_marmita',
    ESCOLHENDO_BEBIDA: 'escolhendo_bebida',
    COLETANDO_ENDERECO: 'coletando_endereco',
    CONFIRMANDO: 'confirmando'
};

// Inicialização do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('QR Code recebido:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('🤖 Bot Marmitex está online!');
});

client.on('message', async (message) => {
    if (message.from.includes('@g.us') || message.from === 'status@broadcast') return;
    
    const phone = message.from;
    const msg = message.body.toLowerCase().trim();
    
    // Inicializar cliente se não existir
    if (!customerData.has(phone)) {
        customerData.set(phone, {
            name: null,
            state: STATES.INICIO,
            cart: [],
            address: null,
            total: 0
        });
    }
    
    const customer = customerData.get(phone);
    let response = '';
    
    try {
        // Comandos especiais
        if (msg.includes('cardapio') || msg.includes('cardápio') || msg.includes('menu')) {
            response = getMenu();
        }
        else if (msg.includes('oi') || msg.includes('olá') || msg.includes('bom dia') || msg.includes('boa tarde') || msg.includes('boa noite') || customer.state === STATES.INICIO) {
            response = getWelcomeMessage();
            customer.state = STATES.ESCOLHENDO_MARMITA;
        }
        else if (customer.state === STATES.ESCOLHENDO_MARMITA) {
            response = handleMarmitaSelection(msg, customer);
        }
        else if (customer.state === STATES.ESCOLHENDO_BEBIDA) {
            response = handleBebidaSelection(msg, customer);
        }
        else if (customer.state === STATES.COLETANDO_ENDERECO) {
            response = handleAddressCollection(msg, customer);
        }
        else if (customer.state === STATES.CONFIRMANDO) {
            response = handleConfirmation(msg, customer);
        }
        else {
            response = "Desculpe, não entendi. Digite *cardapio* para ver nossas opções ou *oi* para começar um novo pedido! 😊";
        }
        
        await message.reply(response);
        
        // Log
        console.log(`📱 ${phone}: ${message.body}`);
        console.log(`🤖 Resposta: ${response.substring(0, 100)}...`);
        console.log('---');
        
    } catch (error) {
        console.error('Erro:', error);
        await message.reply('Ops, tive um probleminha aqui! Tente novamente em alguns segundos 😅');
    }
});

function getWelcomeMessage() {
    return `Olá! Seja bem-vindo ao *Sabor Caseiro*! 😊

🍱 *NOSSAS MARMITAS:*
1️⃣ Tradicional - R$ 15,00
2️⃣ Frango - R$ 14,00
3️⃣ Vegana - R$ 13,00
4️⃣ Fitness - R$ 16,00
5️⃣ do Chefe - R$ 18,00

Digite o *número* da marmita que você quer! 👆`;
}

function getMenu() {
    let menu = `🍱 *CARDÁPIO SABOR CASEIRO*\n\n*MARMITAS:*\n`;
    
    menuData.marmitas.forEach((item, index) => {
        menu += `${index + 1}️⃣ *Marmita ${item.nome}* - R$ ${item.preco.toFixed(2)}\n`;
        menu += `   ${item.desc}\n\n`;
    });
    
    menu += `💧 *BEBIDAS:*\n`;
    menuData.bebidas.forEach((item, index) => {
        menu += `• ${item.nome} - R$ ${item.preco.toFixed(2)}\n`;
    });
    
    menu += `\n🚚 *Taxa de entrega: R$ 3,00*\n`;
    menu += `⏰ *Entrega em 30-45 minutos*\n\n`;
    menu += `Para pedir, digite *oi* e eu te ajudo! 😋`;
    
    return menu;
}

function handleMarmitaSelection(msg, customer) {
    const number = parseInt(msg);
    
    if (number >= 1 && number <= 5) {
        const marmita = menuData.marmitas[number - 1];
        customer.cart = [marmita]; // Resetar carrinho
        customer.state = STATES.ESCOLHENDO_BEBIDA;
        
        return `Ótima escolha! *Marmita ${marmita.nome}* por R$ ${marmita.preco.toFixed(2)} 👍

${marmita.desc}

💧 Quer alguma bebida para acompanhar?
• Digite *1* para Refrigerante (R$ 4,00)
• Digite *2* para Suco Natural (R$ 5,00)  
• Digite *3* para Água (R$ 2,00)
• Digite *nao* se não quiser bebida

Ou digite *finalizar* para ir direto para o endereço! 🏠`;
    }
    
    return `Por favor, digite um número de *1* a *5* para escolher sua marmita! 😊

1️⃣ Tradicional - R$ 15,00
2️⃣ Frango - R$ 14,00  
3️⃣ Vegana - R$ 13,00
4️⃣ Fitness - R$ 16,00
5️⃣ do Chefe - R$ 18,00`;
}

function handleBebidaSelection(msg, customer) {
    if (msg.includes('nao') || msg.includes('não') || msg.includes('finalizar')) {
        customer.state = STATES.COLETANDO_ENDERECO;
        return getAddressRequest(customer);
    }
    
    const number = parseInt(msg);
    if (number >= 1 && number <= 3) {
        const bebida = menuData.bebidas[number - 1];
        customer.cart.push(bebida);
        customer.state = STATES.COLETANDO_ENDERECO;
        
        return `Perfeito! Adicionei *${bebida.nome}* no seu pedido! 🥤

${getAddressRequest(customer)}`;
    }
    
    return `Por favor, escolha uma opção:
• *1* para Refrigerante (R$ 4,00)
• *2* para Suco Natural (R$ 5,00)
• *3* para Água (R$ 2,00)
• *nao* se não quiser bebida`;
}

function getAddressRequest(customer) {
    return `Agora preciso do seu endereço para entrega! 🏠

Por favor, envie seu endereço *completo*:
• Rua/Avenida e número
• Bairro  
• Pontos de referência
• Seu nome para entrega

Exemplo: 
*Rua das Flores, 123 - Centro
Próximo ao mercado São João
Nome: João Silva*`;
}

function handleAddressCollection(msg, customer) {
    if (msg.length < 10) {
        return `Por favor, envie seu endereço *completo* com:
• Rua e número
• Bairro
• Ponto de referência  
• Seu nome

Isso me ajuda a garantir que a entrega chegue certinho! 😊`;
    }
    
    customer.address = msg;
    customer.state = STATES.CONFIRMANDO;
    
    // Calcular total
    const subtotal = customer.cart.reduce((sum, item) => sum + item.preco, 0);
    const taxa = 3.00;
    const total = subtotal + taxa;
    customer.total = total;
    
    let resumo = `🍱 *RESUMO DO SEU PEDIDO:*\n\n`;
    customer.cart.forEach(item => {
        resumo += `• ${item.nome.includes('Marmita') ? item.nome : 'Marmita ' + item.nome} - R$ ${item.preco.toFixed(2)}\n`;
    });
    
    resumo += `\n💰 *VALORES:*\n`;
    resumo += `• Subtotal: R$ ${subtotal.toFixed(2)}\n`;
    resumo += `• Taxa de entrega: R$ ${taxa.toFixed(2)}\n`;
    resumo += `• *Total: R$ ${total.toFixed(2)}*\n\n`;
    
    resumo += `🏠 *Endereço de entrega:*\n${customer.address}\n\n`;
    resumo += `⏰ *Tempo de entrega: 30-45 minutos*\n\n`;
    resumo += `✅ Digite *confirmar* para finalizar o pedido\n`;
    resumo += `❌ Digite *cancelar* se quiser alterar algo`;
    
    return resumo;
}

function handleConfirmation(msg, customer) {
    if (msg.includes('confirmar') || msg.includes('confirmo') || msg.includes('sim')) {
        // Salvar pedido
        const order = {
            phone: customer.phone,
            items: customer.cart,
            address: customer.address,
            total: customer.total,
            date: new Date(),
            status: 'confirmado'
        };
        
        // Reset customer state
        customer.state = STATES.INICIO;
        customer.cart = [];
        
        console.log('🎉 NOVO PEDIDO:', order);
        
        return `🎉 *PEDIDO CONFIRMADO!*

Seu pedido foi recebido e já está sendo preparado! 👨‍🍳

📱 Em caso de dúvidas, entre em contato conosco.
⏰ Previsão de entrega: 30-45 minutos
💵 Total: R$ ${customer.total.toFixed(2)}

Obrigado pela preferência! 😊
_Sabor Caseiro - Comida feita com carinho_`;
    }
    
    if (msg.includes('cancelar') || msg.includes('alterar')) {
        customer.state = STATES.INICIO;
        customer.cart = [];
        return `Pedido cancelado! 😊 Digite *oi* quando quiser fazer um novo pedido!`;
    }
    
    return `Por favor, digite:
✅ *confirmar* para finalizar o pedido
❌ *cancelar* para fazer alterações`;
}

// Iniciar
client.initialize();

console.log('🚀 Iniciando Bot Marmitex Inteligente...');
console.log('📱 Aguardando QR Code...');