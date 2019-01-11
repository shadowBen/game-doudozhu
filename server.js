var express = require('express')
var app = express()
var doudizhu = require("./doudizhu.js").game //./表示当前目录"
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var socketUtil = io.sockets;

let InUsingRooms = {};
let LoginedUsers = [];
let roomIDAIndex = 999;

app.use('/', express.static(__dirname + '/'));
server.listen(8088);

let LEAVEROOM = function(SOCKET, roomID) {
    //找出离开房间的user的roomID对应的人
    let roomUsers = InUsingRooms[roomID];
    if(typeof roomUsers == 'undefined'){
        socketUtil.to(roomID).emit('roomleaved', user, InUsingRooms[roomID], roomID);
        return;
    }
    // 从房间名单中移除
    let index = -1;
    let user = null;
    roomUsers.forEach(function(player, i) {
        if (player.userid == SOCKET.userInfo.userid) {
            index = i;
            user = player;
        }
    });
    if (index !== -1) {
        roomUsers.splice(index, 1);
        //socket离开房间
        SOCKET.leave(roomID, () => {
            // let rooms = Object.keys(SOCKET.rooms);
            // console.log(rooms); // [ <socket.id>, 'room 237' ]
            delete SOCKET.inRoomID
            //通知加入房间的人，有用户离开了
            socketUtil.to(roomID).emit('roomleaved', user, InUsingRooms[roomID], roomID);
            //自己通知不到 因为已经离开房间，所以要定点通知
            SOCKET.emit('roomleaved', user, InUsingRooms[roomID], roomID);
            console.log(user.username + '退出了' + roomID);
            //判断房间还有没有人
            if (roomUsers.length <= 0) { //没有人则清除
                delete InUsingRooms[roomID];
                console.log('清除房间：' + roomID);
            }
            console.log("--------------------------------------------------");
        });
    }
}

socketUtil.on('connection', (socket) => {
    console.log(socket['handshake']['address'] + "客户端连接");
    socket.on('login', function(userInfo) { //用户登录进服务
        let hasThisUser = false;
        LoginedUsers.forEach(function(user, i) {
            if (userInfo.userid == user.userid) {
                hasThisUser = user; //在登录过的用户中找到了当前用户
            }
        });
        let lastTempRoomId = null;
        if(hasThisUser){
            if(!!hasThisUser.socket.inRoomID){//说明掉线前在一个房间里面
                lastTempRoomId = hasThisUser.socket.inRoomID;
            }
        }
        socket.userInfo = userInfo;
        userInfo.socket = socket;

        LoginedUsers.push(userInfo);

        console.log(userInfo.username + "在" + socket['handshake']['address'] + "登录");

        socket.on('createroom', function(user) {
            if (socket.inRoomID) { //如果用户在一个房间
                //那么离开房间
                LEAVEROOM(socket, socket.inRoomID);
            }
            let roomID = "room " + roomIDAIndex; //创建一个room
            roomIDAIndex++;
            // 将用户加入房间名单中
            if (!InUsingRooms[roomID]) {
                InUsingRooms[roomID] = [];
            }
            socket.join(roomID, () => {
                // let rooms = Object.keys(socket.rooms);
                // console.log(rooms); // [ <socket.id>, 'room 237' ]
                socket.inRoomID = roomID;
                user.isReadyToPlay = false;
                user.socketId = socket.id;
                InUsingRooms[roomID].push(user);
                //通知加入房间的人，有用户加入了
                console.log(InUsingRooms[roomID]);
                socketUtil.to(roomID).emit('roomin', user, InUsingRooms[roomID], roomID);
                console.log(user.username + '创建了房间' + roomID);
                console.log("房间里面有" + InUsingRooms[roomID].length + "人");
                console.log(InUsingRooms[roomID])
            });

        });

        socket.on('joinroom', function(user, roomID) {
            let roomUser = InUsingRooms[roomID];
            if (!roomUser || roomUser.length <= 0) {
                console.log(roomID + "房间不存在!");
                socket.emit('roomerror', roomID + "房间不存在!");
            } else {

                if (roomUser.length >= 3) {
                    console.log("房间" + roomID + "已满");
                    socket.emit('roomerror', roomID + "房间已满!");
                } else { //判断是否用户已经在房间，防止重复加入
                    let alreadyInside = false;
                    roomUser.forEach(function(player, i) {
                        if (player.userid == user.userid) {
                            alreadyInside = player;
                        }
                    });
                    if (!alreadyInside) {
                        // 将用户加入房间之前先离开前一个房间
                        if (socket.inRoomID) {
                            LEAVEROOM(socket, socket.inRoomID);
                        }
                        // 将用户加入房间名单中
                        socket.join(roomID, () => {
                            // let rooms = Object.keys(socket.rooms);
                            // console.log(rooms); // [ <socket.id>, 'room 237' ]
                            socket.inRoomID = roomID;
                            user.isReadyToPlay = false;
                            user.socketId = socket.id;
                            roomUser.push(user);
                            //通知加入房间的人，有用户加入了
                            socketUtil.to(roomID).emit('roomin', user, InUsingRooms[roomID], roomID);
                            console.log(user.username + '加入了房间' + roomID);
                            console.log("房间里面有" + InUsingRooms[roomID].length + "人");
                            console.log(InUsingRooms[roomID])
                        });
                    } else {
                        console.log(alreadyInside.username + "已经在房间里面了!");
                    }
                }
            }
        });

        socket.on('leaveroom', function() {
            LEAVEROOM(socket, socket.inRoomID);
        });

        socket.on('readytoplay', function(user) {
            let roomID = socket.inRoomID;
            if (!roomID) {
                console.log(userInfo.username + "不在房间，无法准备");
                socket.emit('roomerror', userInfo.username + "不在房间，无法准备");
            } else {
                let roomUser = InUsingRooms[roomID];
                let userInside = false;
                roomUser.forEach(function(player, i) {
                    if (player.userid == user.userid) {
                        userInside = player;
                    }
                });
                if (!userInside) {
                    console.log(userInfo.username + "不在房间，无法准备");
                    socket.emit('roomerror', userInfo.username + "不在房间，无法准备");
                } else {
                    userInside["isReadyToPlay"] = user.isReadyToPlay;
                    socketUtil.to(roomID).emit('beready', userInside, InUsingRooms[roomID]);
                    let readyNum = 0;
                    InUsingRooms[roomID].forEach(function(player, i) {
                        if (!!player.isReadyToPlay) {
                            readyNum++;
                        }
                    });
                    if (readyNum >= 3) {
                        setTimeout(function() {
                            let oneGame = null;
                            let succsee = function(winnerid){//打完一局
                                socketUtil.to(roomID).emit('finish',winnerid);
                                InUsingRooms[roomID].forEach(function(player, i) {
                                    player.isReadyToPlay = false;
                                });
                            }
                            let failure = function(msg){//流局,重新生成
                                oneGame = new doudizhu(InUsingRooms[roomID],roomID,socketUtil,succsee,failure);
                            }
                            //game start
                            oneGame = new doudizhu(InUsingRooms[roomID],roomID,socketUtil,succsee,failure);
                        }, 0);
                    }
                }
            }
        });
        socket.emit("logined",LoginedUsers.length);

        if(!!lastTempRoomId){
            socket.emit("alreadyLogin",lastTempRoomId);
        }
        if(hasThisUser){
            socket.emit("alreadyLogin",-1);
            hasThisUser.socket.disconnect(true);//踢掉前一个
        }
    });
    // 失去连接
    socket.on('disconnect', function() {
        //第一步 离开room
        if (socket.inRoomID) {
            LEAVEROOM(socket, socket.inRoomID);
        }
        //第二步 清除LoginedUsers中的这个用户
        let hasThisUserIndex = -1;
        LoginedUsers.forEach(function(user, i) {
            if (!!socket.userInfo && socket.userInfo.userid == user.userid) {
                hasThisUserIndex = i;
            }
        });
        if (hasThisUserIndex !== -1) {
            LoginedUsers.splice(hasThisUserIndex, 1);
            console.log(socket.userInfo.username + '===>disconnected');
        } else {
            console.log("未登录的用户" + socket['handshake']['address'] + "离开");
        }
    });
});

console.log('服务器运行于：localhost:8088');