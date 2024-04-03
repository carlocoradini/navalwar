const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
const activeUsers = new Map(); // Mapeia conexões WebSocket para nomes de usuários
let gameStarted = false;

wss.on('connection', function connection(ws) {
    console.log('Nova conexão WebSocket');

    ws.on('message', function incoming(message) {
        const data = JSON.parse(message);

        if (data.type === 'set_username') {
            handleSetUsername(ws, data.username);
        } else if (data.type === 'chat_message') {
            handleChatMessage(ws, data.text);
        } else if (data.type === 'invite') {
            handleInvite(ws, data.username);
        } else if (data.type === 'accept_invite') {
            handleAcceptInvite(ws, data.inviteFrom);
        } else if (data.type === 'reject_invite') {
            handleRejectInvite(ws, data.inviteFrom);
        } else if (data.type === 'start_game' && !gameStarted) {
            console.log('Iniciando o jogo...');
            gameStarted = true;

            // Aqui você pode adicionar a lógica específica do seu jogo para iniciar o jogo

            // Por exemplo, você pode enviar uma mensagem para o cliente para indicar que o jogo começou
            ws.send(JSON.stringify({ type: 'game_started' }));
        }


    });

    ws.on('close', function close() {
        console.log('Conexão WebSocket fechada');
        removeUser(ws);
        sendUserList();
    });
});

function handleSetUsername(ws, username) {
    if (!username || username.trim() === '') {
        console.log('Nome de usuário inválido.');
        return ws.terminate();
    }

    if (activeUsers.has(ws)) {
        console.log('Usuário já autenticado.');
        return ws.terminate();
    }

    activeUsers.set(ws, username);
    console.log(`Usuário ${username} autenticado com sucesso`);
    sendUserList();
}

function handleChatMessage(ws, message) {
    const username = activeUsers.get(ws);
    if (!username) {
        console.log('Usuário não autenticado.');
        return ws.terminate();
    }

    // Broadcast the chat message to all clients
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'chat_message', username: username, text: message }));
        }
    });
}

function removeUser(ws) {
    if (activeUsers.has(ws)) {
        const username = activeUsers.get(ws);
        activeUsers.delete(ws);
        console.log(`Usuário ${username} desconectado`);
    }
}

function sendUserList() {
    const users = [];
    activeUsers.forEach((username, ws) => {
        users.push({ username });
    });

    // Broadcast the user list to all clients
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'user_list', users }));
        }
    });
}

function handleInvite(ws, username) {
    // Verifica se o usuário convidado está online
    let invitedUserWS;
    wss.clients.forEach(client => {
        if (activeUsers.get(client) === username) {
            invitedUserWS = client;
        }
    });

    if (!invitedUserWS) {
        console.log('Usuário convidado não encontrado ou offline.');
        return;
    }

    // Envia o convite para o usuário convidado
    invitedUserWS.send(JSON.stringify({ type: 'invite', inviteFrom: activeUsers.get(ws) }));
}

function handleAcceptInvite(ws, inviteFrom) {
    // Envia uma mensagem de confirmação para o usuário que enviou o convite
    let inviteFromWS;
    wss.clients.forEach(client => {
        if (activeUsers.get(client) === inviteFrom) {
            inviteFromWS = client;
        }
    });

    if (!inviteFromWS) {
        console.log('Usuário que enviou o convite não encontrado.');
        return;
    }

    inviteFromWS.send(JSON.stringify({ type: 'invite_accepted', inviteTo: activeUsers.get(ws) }));

    // Redireciona ambos os usuários para a página do jogo
    ws.send(JSON.stringify({ type: 'redirect_to_game' }));
    inviteFromWS.send(JSON.stringify({ type: 'redirect_to_game' }));
}

function handleRejectInvite(ws, inviteFrom) {
    // Envia uma mensagem de rejeição para o usuário que enviou o convite
    let inviteFromWS;
    wss.clients.forEach(client => {
        if (activeUsers.get(client) === inviteFrom) {
            inviteFromWS = client;
        }
    });

    if (!inviteFromWS) {
        console.log('Usuário que enviou o convite não encontrado.');
        return;
    }

    inviteFromWS.send(JSON.stringify({ type: 'invite_rejected', inviteTo: activeUsers.get(ws) }));
}
console.log('Servidor WebSocket iniciado na porta 8080.');
