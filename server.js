require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { TikTokLiveConnection } = require('tiktok-live-connector');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const TIKTOK_USERNAME = 'tribunnews';

app.use(express.static('public'));

let tiktokConnection = new TikTokLiveConnection(TIKTOK_USERNAME, {});

tiktokConnection.connect().then(state => {
    console.log(`[SUKSES] Terhubung ke Live TikTok: ${TIKTOK_USERNAME} (Room ID: ${state.roomId})`);
}).catch(err => {
    console.log('[GAGAL] Koneksi TikTok Live:', err.message || err);
});

// Fungsi Helper untuk Ekstraksi User Data TikTok
function extractUserData(data) {
    const u = data.user || data.userDetails || data.account || data;
    
    // Cari nickname (Nama Tampilan) terlebih dahulu
    const nickname = data.nickname || u.nickname || 'penonton';
    
    // Cari uniqueId (ID TikTok), abaikan jika nilainya '0', 0, atau undefined
    let username = data.uniqueId || u.uniqueId || data.userId || u.userId;
    if (!username || username === '0' || username === 0) {
        username = nickname; // Gunakan nickname sebagai ID jika uniqueId kosong/'0'
    }
    
    // Cari URL Gambar Profil
    let avatar = '';
    if (u.profilePictureUrl) avatar = u.profilePictureUrl;
    else if (data.profilePictureUrl) avatar = data.profilePictureUrl;
    else if (u.avatarThumb && u.avatarThumb.urlList) avatar = u.avatarThumb.urlList[0];
    else if (u.avatarMedium && u.avatarMedium.urlList) avatar = u.avatarMedium.urlList[0];
    else if (u.avatarLarger && u.avatarLarger.urlList) avatar = u.avatarLarger.urlList[0];

    return { username, nickname, avatar };
}

tiktokConnection.on('member', data => {
    const user = extractUserData(data);
    io.emit('print_left', {
        type: 'join',
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar
    });
});

tiktokConnection.on('chat', data => {
    const user = extractUserData(data);
    const comment = data.comment || data.content || '';

    io.emit('print_right', {
        type: 'comment',
        username: user.username,
        nickname: user.nickname,
        comment: comment
    });
});

tiktokConnection.on('like', data => {
    const user = extractUserData(data);
    const likeCount = data.likeCount || data.count || 1;

    io.emit('print_right', {
        type: 'like',
        username: user.username,
        nickname: user.nickname,
        likeCount: likeCount
    });
});

tiktokConnection.on('gift', data => {
    const user = extractUserData(data);
    const giftName = data.giftName || data.gift?.name || 'Hadiah';
    
    // Ambil gambar gift dari data TikTok
    let giftImage = '';
    if (data.giftPictureUrl) giftImage = data.giftPictureUrl;
    else if (data.gift?.image?.urlList) giftImage = data.gift.image.urlList[0];
    else if (data.icon?.urlList) giftImage = data.icon.urlList[0];

    io.emit('print_right', {
        type: 'gift',
        username: user.username,
        nickname: user.nickname,
        giftName: giftName,
        giftImage: giftImage
    });
});

io.on('connection', (socket) => {
    console.log('Overlay Browser terhubung ke server!');
});

const port = process.env.PORT || 8081;
httpServer.listen(port, () => {
    console.log(`=================================================`);
    console.log(`Server Printer Virtual TikTok BERHASIL berjalan!`);
    console.log(`Buka browser di: http://localhost:${port}`);
    console.log(`=================================================`);
});