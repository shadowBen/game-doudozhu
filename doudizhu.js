// 第一步:定义四个花色，这里就用中文了
const cardType = ["a", "b", "c", "d"]; //['黑桃', '红桃', '梅花', '方块'];
// 第二步:定义13张普通牌
const cardValue = ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'];
//['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
// 第三步:定义2张特殊牌，大王与小王
const specialCard = [{ cardValue: 1000, cardType: "b" }, { cardValue: 999, cardType: "a" }];
//['大王', '小王'];
// 第四步:生成扑克牌
function generatePoker() { // 生成一副扑克牌
    var allCards = []; //生成54张牌
    for (var i = 0,
            len1 = cardType.length; i < len1; i++) {
        for (var j = 0,
                len2 = cardValue.length; j < len2; j++) {
            allCards.push({
                cardValue: cardValue[j] * 1,
                cardType: cardType[i]
            });
        }
    }
    allCards = allCards.concat(specialCard);
    return allCards;
}
const Cards = generatePoker(); //1副有顺序的扑克

// 洗牌算法，传入一个数组，随机乱序numOfSwitch次,排列,不污染原数组
function shuffle(arr, numOfSwitch) {
    if (!arr) { throw '错误，请传入正确数组'; }
    if (!numOfSwitch) { numOfSwitch = arr.length }
    var newArr = arr.slice(0);
    for (var i = numOfSwitch - 1; i >= 0; i--) {
        var randomIndex = Math.floor(Math.random() * (i % arr.length + 1)); // 随机范围[0,1)
        var itemAtIndex = newArr[randomIndex];
        newArr[randomIndex] = newArr[i % arr.length];
        newArr[i % arr.length] = itemAtIndex;
    }
    return newArr;
}
// 随机发N张扑克牌
function dealPoker(num) {
    if (!num || num > 54 || typeof(num) !== 'number') {
        num = 54; //不传数字默认生成1副扑克
    }
    // 洗牌-不污染原先的数组
    var randomCards = shuffle(Cards, 2 * num); //2*num是为了洗牌更多次，会影响洗牌效率
    return randomCards.slice(0, num);
}
// 生成一副洗好的全新乱序牌,测试数据
// var poker = dealPoker(54);
// 接下来如果想要发牌，依次将数组pop即可，因为它本身已经被打乱了，可以一直发完54张


class game {
    //通知消息为：1-游戏开始 2-叫地主 3-抢地主 4-打牌 5-结束 0-更新信息 6 更新对局信息
    init() {
        this.poker = dealPoker();
        this.socketUtil.to(this.roomID).emit('gameinfo', 1); //通知客户端游戏开始
    }
    start() {
        //this.socketUtil.to(this.roomID).emit('gameinfo',4);//通知客户端开始打牌
    }

    callLandlord() { //叫地主，抢地主
        let delieverInfoNum = 2; //默认是叫地主
        let _this = this;
        this.score = 3 * 5 //底分为3,倍数为5倍
        let scoreCopy = this.score;
        this.callLandlordNum = 0; //叫地主次数
        this.userToStart = Math.floor(Math.random() * 3); //[0,3)
        this.usersCopy = this.users.slice(0); //拷贝一份用户信息
        let index = this.userToStart;
        console.log("随机第：" + index + "用户叫地主");
        let dizhuid = null;
        let firstCaller = null;
        this.usersCopy.forEach(function(player, i) {
            //player.cards = []; //除去牌的信息
            player.sitIndex = i; //座位号
            delete player['calledLandload'];
            player.ReadyToCall = false;
            player.isFirstCall = false;
            if (i == _this.userToStart) {
                //firstCaller = player;//记录第一个叫地主的用户
                player.ReadyToCall = true;
                player.isFirstCall = true;
            }
            _this.socketUtil.connected[player.socketId].on('calllandlord', function(whetherCalled) {
                if (!!whetherCalled) { //叫、抢
                    dizhuid = player.userid;
                    if (delieverInfoNum == 2) {
                        delieverInfoNum = 3; //一旦有人叫地主了 就开始抢
                        player.isCaller = true;//是不是叫地主的;
                        firstCaller = player; //记录第一个叫地主的用户，第一个叫地主的积分不翻倍
                    }else{
                        _this.score = _this.score * 2;//抢地主积分翻倍
                    }
                    console.log(player.username + "抢地主");
                } else { //放弃
                    console.log(player.username + "不抢");
                }
                player.ReadyToCall = false;
                player.calledLandload = !!whetherCalled;
                index++;
                console.log(index + "," + _this.userToStart + "+" + _this.usersCopy.length)
                if (index >= _this.userToStart + _this.usersCopy.length) { //一圈地主叫完事了
                    if (dizhuid == null) { //说明没人叫地主
                        console.log("流局");
                        _this.usersCopy.forEach(function(pl, l) { //去除监听
                            _this.socketUtil.connected[pl.socketId].removeAllListeners('calllandlord');
                            _this.socketUtil.connected[pl.socketId].removeAllListeners('outcards');
                        });
                        _this.failure("流局");
                    } else {
                        //如果第一个叫地主的人放弃叫地主了
                        if (dizhuid != firstCaller.userid) { //地主不是第一个人
                            if (!firstCaller.calledLandload) { //第一个人没有叫地主
                                console.log("地主确认了1");
                                console.log("地主id" + dizhuid);
                                _this.usersCopy.forEach(function(player, k) {
                                    if (dizhuid == player.userid) {
                                        player.isLandLoader = true;
                                        player.cards = player.cards.concat(_this.poker); //地主多三张牌
                                        player.cards.sort(sortCards); //给牌排个序
                                        _this.poker.sort(sortCards)
                                        //通知地主加入三张地主牌后的排序后的牌
                                        _this.socketUtil.to(player.socketId).emit('deallandloadercards', _this.poker);
                                    } else {
                                        player.isLandLoader = false;
                                    }
                                });
                                let info = {
                                    landloaderCard: _this.poker,
                                    players: _this.usersCopy
                                }
                                _this.socketUtil.to(_this.roomID).emit('gameinfo', 0, info);
                                _this.playcards(_this.usersCopy);
                            } else {
                                if (!_this.usersCopy[index % _this.usersCopy.length].calledLandload) {
                                    console.log(_this.usersCopy[index % _this.usersCopy.length].username + "因未抢跳过");
                                    index++;
                                }
                                console.log("地主未能确认，通知叫地主2");
                                _this.usersCopy[index % _this.usersCopy.length].ReadyToCall = true;
                                _this.socketUtil.to(_this.roomID).emit('gameinfo', delieverInfoNum, _this.usersCopy);
                            }
                        } else {
                            console.log("地主确认了2");
                            console.log("地主id" + dizhuid);
                            _this.usersCopy.forEach(function(player, k) {
                                if (dizhuid == player.userid) {
                                    player.isLandLoader = true;
                                    player.cards = player.cards.concat(_this.poker); //地主多三张牌
                                    player.cards.sort(sortCards); //给牌排个序
                                    _this.poker.sort(sortCards)
                                    //通知地主加入三张地主牌后的排序后的牌
                                    _this.socketUtil.to(player.socketId).emit('deallandloadercards', _this.poker);
                                } else {
                                    player.isLandLoader = false;
                                }
                            });
                            let info = {
                                landloaderCard: _this.poker,
                                players: _this.usersCopy
                            }
                            _this.socketUtil.to(_this.roomID).emit('gameinfo', 0, info);
                            _this.playcards(_this.usersCopy);
                        }
                    }
                } else {
                    //通知房间内用户谁使用了叫地主的机会
                    console.log("地主未能确认，通知叫地主1");
                    _this.usersCopy[index % _this.usersCopy.length].ReadyToCall = true;
                    _this.socketUtil.to(_this.roomID).emit('gameinfo', delieverInfoNum, _this.usersCopy);
                }
                _this.socketUtil.to(_this.roomID).emit('gameinfo', 6, {
                    score: _this.score,
                    rate: (_this.score / scoreCopy)
                });
            });
        });
        this.socketUtil.to(this.roomID).emit('gameinfo', delieverInfoNum, _this.usersCopy);
    }
    deal() { //分牌
        let _this = this;
        if (this.poker instanceof Array) {
            //分牌是一张一张的分好还是一下子一个人分满
            //目前采用一次分一张给一个人
            this.users.forEach(function(player, i) {
                player.cards = [];
            });
            let index = 0;
            while (this.poker.length > 3) { //留下三张给地主
                this.users[index % this.users.length].cards.push(this.poker.pop());
                index++;
            }
            this.users.forEach(function(player, i) {
                player.cards.sort(sortCards); //给牌排个序
                //通知每个客户端发到的发牌
                _this.socketUtil.to(player.socketId).emit('dealcards', player.cards);
            });
        } else {
            console.log("还没init");
            init();
        }
    }
    playcards(players) { //打牌
        let _this = this;
        _this.users.forEach(function(player, i) {
            _this.socketUtil.connected[player.socketId].on('outcards', function(cardsInfo) {
                _this.socketUtil.to(_this.roomID).emit('gameinfo', 4, cardsInfo);
                if (cardsInfo.cards.length > 0) {
                    let toDelIndex = [];
                    let cardsstr = "";
                    
                    cardsInfo.cards.forEach(function(cardToDelete, i) {
                        player.cards.forEach(function(card, j) {
                            if (cardToDelete.cardValue == card.cardValue && cardToDelete.cardType == card.cardType) {
                                toDelIndex.push(j);
                                cardsstr+=card.cardValue;
                            }
                        });
                    });

                    console.log(player.userid+"出牌:"+cardsstr);

                    toDelIndex.sort(function(a, b) { return a - b }); //从小到大排序
                    while (toDelIndex.length > 0) {
                        var ind = toDelIndex.pop();
                        player.cards.splice(ind, 1);
                    }
                    if (player.cards.length <= 0) {
                        //除去监听
                        _this.usersCopy.forEach(function(pl, l) { //去除监听
                            _this.socketUtil.connected[pl.socketId].removeAllListeners('calllandlord');
                            _this.socketUtil.connected[pl.socketId].removeAllListeners('outcards');
                        });
                        console.log('游戏结束，胜利者是：'+player.userid);
                        _this.succsee(player.userid);
                    }
                }else{
                    console.log(player.userid+"没出牌或者要不起");
                }
            });
        });
    }

    constructor(users, roomID, socketUtil, succedGameover, failedGameover) {
        console.log("生成一桌游戏开始");
        this.users = users.concat([]);
        this.roomID = roomID;
        this.socketUtil = socketUtil;
        this.playerNum = 3;
        //成功打完一局 回调
        if (typeof succedGameover == 'function') {
            this.succsee = succedGameover;
        }
        //流局 回调
        if (typeof failedGameover == 'function') {
            this.failure = failedGameover;
        }
        this.init(); //开始游戏+洗牌
        this.deal(); //发牌
        this.callLandlord(); //叫、抢地主逻辑
        console.log("生成一桌游戏结束");
    }
}

function sortCards(a, b) { //排序
    var returnVal = b.cardValue - a.cardValue; //按牌的值排序
    if (b.cardValue - a.cardValue == 0) { //牌值一样按黑桃红心梅花方块排序
        returnVal = a.cardType.charCodeAt(0) - b.cardType.charCodeAt(0)
    }
    return returnVal
}

exports.game = game;