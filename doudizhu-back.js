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
            player.cards = []; //除去牌的信息
            player.sitIndex = i; //座位号
            if (i == _this.userToStart) {
                //firstCaller = player;//记录第一个叫地主的用户
                player.ReadyToCall = true;
                player.isFirstCall = true;
            }
            _this.socketUtil.connected[player.socketId].on('calllandlord', function(whetherCalled) {
                if (!!whetherCalled) { //叫、抢
                    dizhuid = player.userid;
                    _this.score = _this.score * 2;
                    if (delieverInfoNum == 2) {
                        delieverInfoNum = 3; //一旦有人叫地主了 就开始抢
                        firstCaller = player; //记录第一个叫地主的用户
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
                            _this.socketUtil.connected[pl.socketId].removeAllListeners(['calllandlord']);
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
                                        //通知地主加入三张地主牌后的排序后的牌
                                        _this.socketUtil.to(player.socketId).emit('deallandloadercards', player.cards);
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
                                    //通知地主加入三张地主牌后的排序后的牌
                                    _this.socketUtil.to(player.socketId).emit('deallandloadercards', player.cards);
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
                console.log("信息来自：" + player.userid);
                if (cardsInfo.cards.length > 0) {

                }
                _this.socketUtil.to(_this.roomID).emit('gameinfo', 4, cardsInfo);
            });
        });
    }



    constructor(users, roomID, socketUtil, succedGameover, failedGameover) {
        console.log("生成一桌游戏开始");
        this.users = users;
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

function isDanPai(outgoingCardsInorder) { //判断是不是单牌
    var isDanPai = true;
    var cards = outgoingCardsInorder;
    if (cards.length != 1) {
        isDanPai = false;
    }
    return isDanPai;
}

function isPair(outgoingCardsInorder) { //判断是不是对子
    var isPair = true;
    var cards = outgoingCardsInorder;
    if (cards[0].cardValue != cards[1].cardValue) {
        isPair = false;
    } else if (cards.length != 2) {
        isPair = false;
    }
    return isPair;
}

function isJokers(outgoingCardsInorder) { //判断是不是王炸
    var isJokers = false;
    var cards = outgoingCardsInorder;
    if (cards.length == 2 && cards[0].cardValue + cards[1].cardValue == 1999) {
        isJokers = true;
    }
    return isJokers;
}

function isThreeWithNone(outgoingCardsInorder) { //判断是不是三不带
    var cards = outgoingCardsInorder;
    var size = cards.length;
    var isThreeWithNone = true;
    if (size != 3) {
        isThreeWithNone = false;
    } else {
        if (cards[0].cardValue == cards[1].cardValue && cards[0].cardValue == cards[2].cardValue) {} else {
            isThreeWithNone = false;
        }
    }
    return isThreeWithNone;
}

function isBoom(outgoingCardsInorder) { //判断是不是炸弹
    var isBoom = true;
    var cards = outgoingCardsInorder;
    if (cards.length != 4) {
        isBoom = false;
    } else {
        if (!(cards[0].cardValue == cards[1].cardValue &&
                cards[1].cardValue == cards[2].cardValue &&
                cards[2].cardValue == cards[3].cardValue)) {
            isBoom = false;
        }
    }
    return isBoom;
}

function isThreeWithOne(outgoingCardsInorder) { //判断是不是三带一
    var isThreeWithOne = true;
    var cards = outgoingCardsInorder;
    if (cards.length != 4) {
        isThreeWithOne = false;
    } else { //排序后的三带一只有 xxxy xyyy
        if (cards[1].cardValue != cards[2].cardValue || cards[0].cardValue == cards[3].cardValue) {
            isThreeWithOne = false;
        } else { //确保了 *xx# 形式  *=x #=y 或者 *=y #=x;
            if (!(cards[0].cardValue == cards[1].cardValue || cards[2].cardValue == cards[3].cardValue)) {
                isThreeWithOne = false;
            }
        }
    }
    if (isThreeWithOne) { //额外功能 排个序 将yyxxx 变成 xxxyy
        if (cards[0].cardValue != cards[1].cardValue) { //yxxx
            outgoingCardsInorder.reverse();
        }
    }
    return isThreeWithOne;
}

function isThreeWithTwo(outgoingCardsInorder) { //判断是不是三带二
    var isThreeWithTwo = true;
    var cards = outgoingCardsInorder;
    if (cards.length != 5) {
        isThreeWithTwo = false;
    } else { //排序后的三带二只有 xxxyy xxyyy
        if (cards[0].cardValue != cards[1].cardValue || cards[3].cardValue != cards[4].cardValue) {
            isThreeWithTwo = false;
        } else { //确保了 xx*yy形式  *应该要=x 或者y才是三带二
            if (cards[2].cardValue != cards[1].cardValue && cards[2].cardValue != cards[4].cardValue) {
                isThreeWithTwo = false;
            }
        }
    }
    if (isThreeWithTwo) { //额外功能 排个序 将yyxxx 变成 xxxyy
        if (cards[1].cardValue != cards[2].cardValue) { //yyxxx
            outgoingCardsInorder.reverse();
        }
    }
    return isThreeWithTwo;
}

function isShunzi(outgoingCardsInorder) { //判断是不是顺子
    var cards = outgoingCardsInorder;
    var isShunzi = true;
    if (cards.length < 5 || cards.length > 12) {
        isShunzi = false;
    } else {
        var size = cards.length;
        for (var i = 0; i < size - 1; i++) {
            var _this = cards[i].cardValue * 1;
            var _next = cards[i + 1].cardValue * 1;
            if (_this >= 15 || _next >= 15) { //2-小王-大王不能在顺子里面
                isShunzi = false;
                break;
            } else {
                if (_this - _next != 1) { //说明不是连续的
                    isShunzi = false;
                    break;
                }
            }
        }
    }
    if (isShunzi) { //额外功能 排个序 变成 小->大 的顺子
        outgoingCardsInorder.reverse();
    }
    return isShunzi;
}

function isPairsConnect(outgoingCardsInorder) { //判断是不是连对
    var isPairsConnect = true;
    var cards = outgoingCardsInorder;
    var size = cards.length;
    if (size % 2 != 0 || size < 6) {
        isPairsConnect = false;
    } else {
        for (var i = 0; i < (size / 2 - 1); i++) {
            var one = cards[i * 2].cardValue * 1;
            var two = cards[i * 2 + 1].cardValue * 1;
            var nextone = cards[(i + 1) * 2].cardValue * 1;
            var nexttwo = cards[(i + 1) * 2 + 1].cardValue * 1;
            if (one == two && nextone == nexttwo) {
                if (one - nextone != 1) {
                    isPairsConnect = false;
                    break;
                } else if (one == 15 || two == 15 || nextone == 15 || nexttwo == 15) {
                    isPairsConnect = false;
                    break;
                }
            } else {
                isPairsConnect = false;
                break;
            }
        }
    }
    if (isPairsConnect) { //额外功能 排个序 变成 小->大 的连对
        outgoingCardsInorder.reverse();
    }
    return isPairsConnect;
}

function isFourWithTwo(outgoingCardsInorder) { //判断是不是四带二
    var isFourWithTwo = true;
    var cards = outgoingCardsInorder;
    if (cards.length != 6) {
        isFourWithTwo = false;
    } else { //xxxxyz yxxxxz yzxxxx
        if (cards[2].cardValue != cards[3].cardValue) {
            isFourWithTwo = false;
        } else { //保证了是 **xx**
            if (cards[2].cardValue != cards[1].cardValue && cards[3].cardValue != cards[4].cardValue) {
                isFourWithTwo = false;
            } else { //确保了 *xxx** 或者**xxx*
                if (cards[1].cardValue == cards[2].cardValue && cards[2].cardValue == cards[3].cardValue) { //*xxx**
                    //第一个和第五个都不和234相等
                    if (cards[0].cardValue != cards[1].cardValue && cards[3].cardValue != cards[4].cardValue) {
                        isFourWithTwo = false;
                    }
                } else if (cards[2].cardValue == cards[3].cardValue && cards[3].cardValue == cards[4].cardValue) { //**xxx*
                    if (cards[2].cardValue != cards[1].cardValue && cards[5].cardValue != cards[4].cardValue) {
                        isFourWithTwo = false;
                    }
                } else {
                    isFourWithTwo = false;
                }
            }
        }
    }
    if (isFourWithTwo) { //额外功能 排个序 变成xxxxyz 
        //处理 yxxxxz
        if (cards[0].cardValue != cards[1].cardValue && cards[4].cardValue != cards[5].cardValue) {
            //将y shift 出来后 加入到数组中
            outgoingCardsInorder.push(outgoingCardsInorder.shift());
        } else if (cards[0].cardValue != cards[1].cardValue && cards[4].cardValue == cards[5].cardValue) { //处理yzxxxx
            outgoingCardsInorder.reverse();
        }
    }
    return isFourWithTwo;
}

function isPlaneWithNone(outgoingCardsInorder) { //判断是不是飞机不带
    var isPlaneWithNone = true;
    var cards = outgoingCardsInorder;
    var size = cards.length;
    if (size % 3 != 0) {
        isPlaneWithNone = false;
    } else {
        for (var i = 0; i < (size / 3 - 1); i++) {
            var one = cards[i * 3].cardValue * 1;
            var two = cards[i * 3 + 1].cardValue * 1;
            var three = cards[i * 3 + 2].cardValue * 1;
            var nextone = cards[(i + 1) * 3].cardValue * 1;
            var nexttwo = cards[(i + 1) * 3 + 1].cardValue * 1;
            var nextthree = cards[(i + 1) * 3 + 2].cardValue * 1;
            if (one == two && two == three && nextone == nexttwo && nexttwo == nextthree) {
                if (one - nextone != 1) {
                    isPlaneWithNone = false;
                    break;
                }
            } else {
                isPlaneWithNone = false;
                break;
            }
        }
    }
    if (isPlaneWithNone) { //额外功能 排个序
        outgoingCardsInorder.reverse();
    }
    return isPlaneWithNone;
}

function isPlaneWithSingle(outgoingCardsInorder) { //判断是不是飞机带单牌
    var isPlaneWithSingle = true;
    var cards = outgoingCardsInorder;
    var cardsCopy = cards.concat([]);
    var threeArr = [];
    var size = cards.length;
    if (size < 8 || size % 4 != 0) {
        isPlaneWithSingle = false;
    } else { //判断是否是3个的数量=单牌的数量
        var threeTimeArr = []; //出现3个时的序号
        for (var i = 0; i < size - 2; i++) {
            var one = cards[i].cardValue * 1;
            var two = cards[i + 1].cardValue * 1;
            var three = cards[i + 2].cardValue * 1;
            if (one == two && two == three) {
                threeTimeArr.push(i);
            }
        }
        var ll = threeTimeArr.length;
        while (threeTimeArr.length > 0) {
            var index = threeTimeArr.pop();
            threeArr.concat(cardsCopy.splice(index, 3));
        }
        //剩下的需要都是对子
        console.log("剩下的单牌们");
        console.log(cardsCopy);
        var singlesize = cardsCopy.length;
        //分离出来的三张
        console.log("分离出的三张");
        console.log(threeArr);

        //三张牌出现次数 == 剩余单牌张数
        if (ll != singlesize) {
            isPlaneWithSingle = false;
        } else {
            if (!$scope.isPlaneWithNone(threeArr)) {
                isPlaneWithSingle = false;
            }
        }
    }
    if (isPlaneWithSingle) { //排序成xxxyyyzd的格式
        outgoingCardsInorder = threeArr.concat(cardsCopy);
    }
    return isPlaneWithSingle
}

function isPlaneWithPair(outgoingCardsInorder) { //判断是不是飞机带对子
    var isPlaneWithPair = true;
    var cards = outgoingCardsInorder;
    var cardsCopy = cards.concat([]);
    var threeArr = [];
    var size = cards.length;
    if (size < 10 || size % 5 != 0) {
        isPlaneWithPair = false;
    } else { //判断3个的数量 == 对子牌的数量
        var threeTimeArr = []; //出现3个时的序号
        for (let i = 0; i < size - 2; i++) {
            var one = cards[i].cardValue * 1;
            var two = cards[i + 1].cardValue * 1;
            var three = cards[i + 2].cardValue * 1;
            if (one == two && two == three) {
                threeTimeArr.push(i);
            }
        }
        var ll = threeTimeArr.length;
        while (threeTimeArr.length > 0) {
            var index = threeTimeArr.pop();
            threeArr.concat(cardsCopy.splice(index, 3));
        }
        //剩下的需要都是对子
        console.log("剩下的对子");
        console.log(cardsCopy);
        var pairsize = cardsCopy.length;
        //分离出来的三张
        console.log("分离出的三张");
        console.log(threeArr);
        //三张牌出现次数 == 剩余单牌张数
        if (pairsize % 2 != 0) {
            isPlaneWithPair = false;
        } else {
            if (ll != pairsize / 2) {
                isPlaneWithPair = false;
            } else if (!$scope.isPlaneWithNone(threeArr)) {
                isPlaneWithPair = false;
            } else {
                for (var j = 0; j < pairsize / 2; j++) {
                    var pairone = cardsCopy[j * 2].cardValue * 1;
                    var pairtwo = cardsCopy[j * 2 + 1].cardValue * 1;
                    if (pairone != pairtwo) {
                        isPlaneWithPair = false;
                        break;
                    }
                }
            }
        }
    }
    if (isPlaneWithPair) { //排序成xxxyyyzzdd的格式
        outgoingCardsInorder = threeArr.concat(cardsCopy);
    }
    return isPlaneWithPair
}

function isFourWithTwoPair(outgoingCardsInorder) { //判断是不是四带两对
    var isFourWithTwoPair = false;
    var cards = outgoingCardsInorder;
    if (cards.length == 8) { //只有xxxxyyzz、yyxxxxzz、yyzzxxxx
        var v1 = cards[0].cardValue;
        var v2 = cards[1].cardValue;
        var v3 = cards[2].cardValue;
        var v4 = cards[3].cardValue;
        var v5 = cards[4].cardValue;
        var v6 = cards[5].cardValue;
        var v7 = cards[6].cardValue;
        var v8 = cards[7].cardValue;
        if (v1 == v2 && v2 == v3 && v3 == v4 && v5 == v6 && v7 == v8) { //xxxxyyzz
            isFourWithTwoPair = true;
        } else if (v1 == v2 && v3 == v4 && v4 == v5 && v5 == v6 && v7 == v8) { //yyxxxxzz
            isFourWithTwoPair = true;
            outgoingCardsInorder.push(outgoingCardsInorder.shift()); //变成了yxxxxzzy
            outgoingCardsInorder.push(outgoingCardsInorder.shift()); //变成了xxxxzzyy
        } else if (v1 == v2 && v3 == v4 && v5 == v6 && v6 == v7 && v7 == v8) { //yyzzxxxx
            isFourWithTwoPair = true;
            outgoingCardsInorder.reverse();
        }
    }
    return isFourWithTwoPair;
}
const cardRules = ['自己出牌','单牌','对子','三不带','顺子','三带二','连对','四带二','飞机不带','飞机带单牌','飞机带对子','四带二对','炸弹','王炸'];
function cardsRuleCheck(outgoingCards){
        outgoingCards = outgoingCards.sort(sortCards);
        var canout = -1;
        var length = outgoingCards.length;
        switch(length){
            case 1:
                if($scope.isDanPai(outgoingCards)){
                    canout = 1;
                };
                break;
            case 2:
                if($scope.isPair(outgoingCards)){
                    canout = 2;
                }else if($scope.isJokers(outgoingCards)){
                    canout = 13;
                }else{
                    canout = -1;
                }
                break;
            case 3:
                if($scope.isThreeWithNone(outgoingCards)){
                    canout = 3;
                }else{
                    canout = -1;
                }
                break;
            case 4:
                if($scope.isBoom(outgoingCards)){
                    canout = 12;
                }else{
                    canout = -1;
                }
                break;
            default:
                if($scope.isShunzi(outgoingCards)){
                    canout = 4;
                }else if($scope.isThreeWithTwo(outgoingCards)){
                    canout = 5;
                }else if($scope.isPairsConnect(outgoingCards)){
                    canout = 6;
                }else if($scope.isFourWithTwo(outgoingCards)){
                    canout = 7;
                }else if($scope.isPlaneWithNone(outgoingCards)){
                    canout = 8;
                }else if($scope.isPlaneWithSingle(outgoingCards)){
                    canout = 9;
                }else if($scope.isPlaneWithPair(outgoingCards)){
                    canout = 10;
                }else if($scope.isFourWithTwoPair(outgoingCards)){
                    canout = 11;
                }else{
                    canout = -1;
                }
        }
        console.log("出牌规则:"+cardRules[canout]);
        return canout;
    }
}

exports.game = game;