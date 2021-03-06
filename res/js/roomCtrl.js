App.controller('roomCtrl', ['$scope', '$stateParams', '$state', 'socket', '$interval', 'util', '$timeout', function($scope, $stateParams, $state, socket, $interval, util, $timeout) {

	var cards = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];
    var threeCards = [18,19,20]

	$scope.landloadcards = threeCards;
    $scope.cards = [];
    $scope.prevcards = [];
    $scope.nextcards = [];

    $scope.operationText = "叫";//抢
    $scope.textInUse = {
        "calllandloader": "地主",
        "notcalllandloader":"不",
    }

    $scope.skipTextPrev = '不要';
    $scope.skipTextSelf = '不要';
    $scope.skipTextNext = '不要';

    $scope.playCardMaxTime = 30;


    $scope.canplay = false;//true;//游戏开始了吗？
    $scope.canCallLandloader = false;//true;//可以叫地主，抢地主了吗
    $scope.canPlayPokers = false;//可以打牌了吗

    $scope.prevUser = null;
    $scope.nextUser = null;

    $scope.selfSkip = false;
    $scope.prevSkip = false;
    $scope.nextSkip = false;

    $scope.selflastoutCards = [];//自己上次打出的牌
    $scope.prevlastoutCards = [];//上家上次打出的牌
    $scope.nextlastoutCards = [];//下家上次打出的牌

    $scope.againstCardType = 0;

    var clearAll = function(){
        if(!!$scope.timerLeft){
            $interval.cancel($scope.timerLeft);
            $scope.eventTimeLimitLeft = -2;
        }
        if(!!$scope.timerRight){
            $interval.cancel($scope.timerRight);
            $scope.eventTimeLimitRight = -2;
        }
        if(!!$scope.timerSelf){
            $interval.cancel($scope.timerSelf);
            $scope.eventTimeLimit = -2;
        }
    }

    var sortCards = function(a,b){//排序
        var returnVal = b.cardValue-a.cardValue;//按牌的值排序
        if(b.cardValue-a.cardValue == 0){//牌值一样按黑桃红心梅花方块排序
            returnVal = a.cardType.charCodeAt(0) - b.cardType.charCodeAt(0)
        }
        return returnVal
    }
	//进入房间该有的监听
    socket.removeAllListeners('roomin');
	socket.on('roomin', function(user, roomUser, roomId) {
        if (user.userid == $scope.userInfo.userid) {
            console.log("进入了房间" + roomId)
        } else {
            console.log("用户" + user.username + "进入了房间" + roomId)
        }
        roomUser.forEach(function(player, i) {
            if ($scope.userInfo.userid == player.userid) {
                console.log("自己准备好的状态是" + player.isReadyToPlay)
                $scope.userInfo.isReadyToPlay = player.isReadyToPlay;
                $scope.userInfo.selfIndex = i;
            } else {
                console.log(player.username + "准备好的状态是" + player.isReadyToPlay)
            }
        });
        $scope.gammers = roomUser;//本局参与者
        if($scope.gammers.length == 2){
            if($scope.userInfo.selfIndex == 1){//[prev,self]
                $scope.prevUser = $scope.gammers[0];
                $scope.nextUser = null;
            }else{//[self,prev]
                $scope.nextUser = $scope.gammers[1];
                $scope.prevUser = null;
            }
        }else if($scope.gammers.length == 3){
            $scope.nextUser = $scope.gammers[($scope.userInfo.selfIndex+1)%3];
            $scope.prevUser = $scope.gammers[($scope.userInfo.selfIndex+2)%3];
        }
        $scope.$apply();
    });
    //是否准备的监听
    socket.removeAllListeners('beready');
    socket.on('beready', function(user, roomUser) {
        if (!!user.isReadyToPlay) {
            console.log(user.username + "准备好了");
        } else {
            console.log(user.username + "取消准备了");
        }
        $scope.gammers = roomUser;//本局参与者
        if($scope.gammers.length == 2){
            if($scope.userInfo.selfIndex == 1){//[prev,self]
                $scope.prevUser = $scope.gammers[0];
                $scope.nextUser = null;
            }else{//[self,prev]
                $scope.nextUser = $scope.gammers[1];
                $scope.prevUser = null;
            }
        }else if($scope.gammers.length == 3){
            $scope.nextUser = $scope.gammers[($scope.userInfo.selfIndex+1)%3];
            $scope.prevUser = $scope.gammers[($scope.userInfo.selfIndex+2)%3];
        }
        $scope.$apply();
    });
    //离开房间的监听
    socket.removeAllListeners('roomleaved');
    socket.on('roomleaved', function(user, roomUser, roomId) {
        //离开后不能将用户直接变成null；需要判断是否电脑代打
        if (user.userid == $scope.userInfo.userid) {
            $scope.userInfo.isReadyToPlay = false;
            delete $scope.userInfo['roomid'];
            console.log(socket.$event);
            console.log(socket);
            $state.go('home', {userInfo:$scope.userInfo});
        } else if(user.userid == $scope.nextUser.userid){
            // $scope.nextUserLeave = true;
            $scope.nextUser = null;
        }else{
            // $scope.prevUserLeave = true;
            $scope.prevUser = null;
        }
        console.log("用户" + user.username + "离开了房间" + roomId);
        $scope.$apply();
    });

    socket.removeAllListeners('gameinfo');
    socket.on('gameinfo', function(cases, otherInfo) {
        //通知消息为：1-游戏开始 2-叫地主 3-抢地主 4-打牌 5-结束 0-更新分数,地主等相关信息
        switch (cases) {
            case 0:
                clearAll();
                $scope.selfSkip = false;
                $scope.prevSkip = false;
                $scope.nextSkip = false;
                $scope.skipTextPrev = '不要';
                $scope.skipTextSelf = '不要';
                $scope.skipTextNext = '不要';
                //console.log("三张地主牌是:"+JSON.stringify(otherInfo.landloaderCard));
                $scope.landloadcards = otherInfo.landloaderCard;
                var landloader = null;
                otherInfo.players.forEach(function(player, i) {
                    if (!!player.isLandLoader) {
                        console.log(player.username + "是地主");
                        landloader = player;
                    }
                });
                if(landloader && landloader.userid != $scope.userInfo.userid){//地主是别人
                    if(landloader.userid == $scope.prevUser.userid){//上家
                        $scope.prevcards = $scope.prevcards.concat(threeCards);
                        $scope.selfRole = 'role farmer';
                        $scope.prevRole = 'role lanloader';
                        $scope.nextRole = 'role farmer';
                        $scope.myturn = false;
                        $scope.newEventLeft($scope.playCardMaxTime);
                    }else if(landloader.userid == $scope.nextUser.userid){//下家
                        $scope.nextcards = $scope.nextcards.concat(threeCards);
                        $scope.selfRole = 'role farmer';
                        $scope.prevRole = 'role farmer';
                        $scope.nextRole = 'role lanloader';
                        $scope.myturn = false;
                        $scope.newEventRight($scope.playCardMaxTime);
                    }
                }else{
                    $scope.selfRole = 'role lanloader';
                    $scope.prevRole = 'role farmer';
                    $scope.nextRole = 'role farmer';
                    $scope.myturn = true;
                    $scope.newEventSelf($scope.playCardMaxTime,$scope.autoOutCards);
                }
                $scope.canPlayPokers = true;
                $scope.canCallLandloader = false;
                console.log("上家牌数："+$scope.prevcards.length);
                console.log("下家牌数："+$scope.nextcards.length);
                console.log("自己牌数："+$scope.cards.length);
                $scope.$apply();
                break;
            case 1:
                $scope.selfSkip = false;
                $scope.prevSkip = false;
                $scope.nextSkip = false;
                $scope.skipTextPrev = '不要';
                $scope.skipTextSelf = '不要';
                $scope.skipTextNext = '不要';
                console.log("游戏开始");
                $scope.canplay = true;
                $scope.$apply();
                break;
            case 2:
                clearAll();
                $scope.operationText = "叫";//抢
                otherInfo.forEach(function(player, i) {
                    if (!!player.ReadyToCall && player.userid == $scope.userInfo.userid) {
                        console.log("轮到自己叫地主");
                        //上家需要显示出有没有叫
                        $scope.selfSkip = false;
                        var prevCalled = otherInfo[(i+2)%otherInfo.length].calledLandload;
                        if(typeof prevCalled == 'boolean'){
                            if(prevCalled == false){
                                $scope.prevSkip = true;
                                $scope.skipTextPrev = '不叫';
                            }else{
                                $scope.prevSkip = true;
                                $scope.skipText = '叫地主';
                            }
                        }
                        $scope.canCallLandloader = true;
                        $scope.$apply();
                        $scope.newEventSelf($scope.playCardMaxTime,$scope.callLandlord);
                    }else if(!!player.ReadyToCall && player.userid == $scope.nextUser.userid){
                        console.log("轮到下家叫地主");
                        //自己需要显示出有没有叫
                        $scope.nextSkip = false;
                        var selfCalled = otherInfo[(i+2)%otherInfo.length].calledLandload;
                        if(typeof selfCalled == 'boolean'){
                            if(selfCalled == false){
                                $scope.selfSkip = true;
                                $scope.skipTextSelf = '不叫';
                            }else{
                                $scope.selfSkip = true;
                                $scope.skipText = '叫地主';
                            }
                        }
                        $scope.canCallLandloader = false;
                        $scope.$apply();
                        $scope.newEventRight($scope.playCardMaxTime);
                    }else if(!!player.ReadyToCall && player.userid == $scope.prevUser.userid){
                        console.log("轮到上家叫地主");
                        //下家需要显示出有没有叫
                        $scope.prevSkip = false;
                        var nextCalled = otherInfo[(i+2)%otherInfo.length].calledLandload;
                        if(typeof nextCalled == 'boolean'){
                            if(nextCalled == false){
                                $scope.nextSkip = true;
                                $scope.skipTextNext = '不叫';
                            }else{
                                $scope.nextSkip = true;
                                $scope.skipTextNext = '叫地主';
                            }
                        }
                        $scope.canCallLandloader = false;
                        $scope.$apply();
                        $scope.newEventLeft($scope.playCardMaxTime);
                    }
                });
                break;
            case 3:
                clearAll();
                $scope.operationText = "抢";//抢
                otherInfo.forEach(function(player, i) {
                    if (!!player.ReadyToCall && player.userid == $scope.userInfo.userid) {
                        console.log("轮到自己抢地主");



                        $scope.canCallLandloader = true;
                        $scope.$apply();
                        $scope.newEventSelf($scope.playCardMaxTime,$scope.callLandlord);
                    }else if(!!player.ReadyToCall && player.userid == $scope.nextUser.userid){
                        console.log("轮到下家抢地主");


                        var nextplayer = otherInfo[(i+1)%otherInfo.length];//下家的下家=上家
                        var prevplayer = otherInfo[(i+2)%otherInfo.length];//下家的下家的下家=自己
                        if(!!nextplayer.isCaller){//说明上家叫的地主

                        }else if(!!prevplayer.isCaller){//说明自己叫的地主

                        }else{//说明下家自己叫地主

                        }

                        $scope.canCallLandloader = false;
                        $scope.$apply();
                        $scope.newEventRight($scope.playCardMaxTime);
                    }else if(!!player.ReadyToCall && player.userid == $scope.prevUser.userid){
                        console.log("轮到上家抢地主");




                        $scope.canCallLandloader = false;
                        $scope.$apply();
                        $scope.newEventLeft($scope.playCardMaxTime);
                    }
                });
                break;
            case 4:
                $scope.selfSkip = false;
                clearAll();
                var cardsFromId = otherInfo.fromid;//出牌人id
                if(cardsFromId == $scope.userInfo.userid){
                    //console.log('自己出的牌: 产生下家计时器 界面显示');
                    
                    //界面显示打的牌
                    $scope.selflastoutCards = otherInfo.cards;

                    var str = "自己打牌：";
                    otherInfo.cards.forEach(function(card,i){
                        str+=card.cardValue;
                    });
                    console.log(str);

                    if($scope.selflastoutCards.length<=0){
                        $scope.selfSkip = true;
                    }else{
                        $scope.selfSkip = false;
                    }
                    $scope.myturn = false;
                    //删除自己的牌中打掉的牌
                    var toDelIndex = [];
                    $scope.selflastoutCards.forEach(function(cardToDelete,i){
                        $scope.cards.forEach(function(card,j){
                            if(cardToDelete.cardValue == card.cardValue && cardToDelete.cardType == card.cardType){
                                toDelIndex.push(j);
                            }
                        });
                    });
                    toDelIndex.sort(function(a,b){return a-b});//从小到大排序

                    while(toDelIndex.length>0){
                        var ind = toDelIndex.pop();
                        $scope.cards.splice(ind,1);
                    }
                    if($scope.cards.length<=0){//牌全部打掉了，游戏结束
                        console.log("自己牌打完了");
                        
                    }else{
                        //游戏未结束，产生下家操作计时器
                        $scope.newEventRight($scope.playCardMaxTime);
                    }

                }else if(cardsFromId == $scope.nextUser.userid){
                    //console.log('下家出的牌:  产生上家的计时器 界面显示牌');
                    //界面显示打的牌
                    $scope.nextlastoutCards = otherInfo.cards;

                    var str = "下家打牌：";
                    otherInfo.cards.forEach(function(card,i){
                        str+=card.cardValue;
                    });
                    console.log("下家有牌:"+$scope.nextcards.length+"张");
                    console.log(str);

                    if($scope.nextlastoutCards.length<=0){
                        $scope.nextSkip = true;
                    }else{
                        $scope.nextSkip = false;
                        $scope.againstCardType = otherInfo.cardsType;
                        $scope.againstCard = otherInfo.cards;
                    }

                    $scope.myturn = false;

                    $scope.nextcards.length = $scope.nextcards.length - $scope.nextlastoutCards.length;

                    if($scope.nextcards.length<=0){//牌全部打掉了，游戏结束
                        console.log("下家牌打完了");
                        
                    }else{
                        //游戏未结束，产生上家操作计时器
                        $scope.newEventLeft($scope.playCardMaxTime);
                    }

                }else if(cardsFromId == $scope.prevUser.userid){
                    //console.log('上家出的牌:  产生自己的计时器 界面显示 准备出牌');
                    //界面显示打的牌
                    $scope.prevlastoutCards = otherInfo.cards;

                    var str = "上家打牌：";
                    otherInfo.cards.forEach(function(card,i){
                        str+=card.cardValue;
                    });
                    console.log("上家有牌:"+$scope.prevcards.length+"张");
                    console.log(str);

                    if($scope.prevlastoutCards.length<=0){
                        $scope.prevSkip = true;
                    }else{
                        $scope.prevSkip = false;
                    }
                    console.log("上家有牌:"+$scope.prevcards.length+"张");
                    $scope.prevcards.length = $scope.prevcards.length - $scope.prevlastoutCards.length;

                    if($scope.prevcards.length<=0){//牌全部打掉了，游戏结束
                        console.log("上家牌打完了");
                        
                    }else{
                        $scope.myturn = true;
                        $scope.selflastoutCards = [];
                        //记录出牌类型 进行提示要不起或者出牌
                        if(!$scope.prevSkip){//如果上家出牌没有过牌
                            $scope.againstCardType = otherInfo.cardsType;
                            $scope.againstCard = otherInfo.cards;
                        }else{//如果上家过牌了，需要看看上上家出的牌的类型(上上家=下家)
                            if($scope.nextSkip){//如果上上家过牌
                                $scope.againstCardType = 0;
                            }
                        }
                        $scope.posibleCards = [];//清除上次的提示
                        console.log("需出牌类型:"+cardRules[$scope.againstCardType]);
                        if($scope.againstCardType != 0){
                            if($scope.tipCards().length>0){//代表系统检测到有牌可以大过要接的牌
                                //游戏未结束，产生自己操作计时器
                                $scope.newEventSelf($scope.playCardMaxTime,$scope.autoOutCards);
                            }else{
                                //系统检测到没有接上家的牌
                                $scope.newEventSelf($scope.playCardMaxTime,$scope.skipOver);
                                //并且要提示用户没有大的牌
                                console.log("没有要的起的牌");
                            }
                        }else{
                            $scope.newEventSelf($scope.playCardMaxTime,$scope.autoOutCards);
                        }
                    }
                    
                }
                $scope.$apply();
                break;
            case 5:
                console.log("结束");
                $scope.canCallLandloader = false;
                $scope.canplay = false;
                $scope.canPlayPokers = false;
                $scope.$apply();
                break;
            case 6:
                console.log("游戏底分：" + otherInfo.score + ", 倍数：" + otherInfo.rate);
                break;
        }
    });
    socket.removeAllListeners('dealcards');
    socket.on('dealcards', function(selfcards) {
        console.log("发到牌啦");
        console.log(JSON.stringify(selfcards));
        $scope.cards = selfcards.concat([]);
        $scope.prevcards = cards.concat([]);
        $scope.nextcards = cards.concat([]);
    });

    socket.removeAllListeners('deallandloadercards');
    socket.on('deallandloadercards', function(landloadercards) {
        console.log('发到地主牌了');
        $scope.cards = $scope.cards.concat(landloadercards);
        $scope.cards.sort(sortCards);
    });

    socket.removeAllListeners('finish');
    socket.on('finish', function(winnerid) {
        
        console.log('打光所有牌的人是'+winnerid);
        if(winnerid == $scope.userInfo.userid){
            if($scope.selfRole=='role lanloader'){//自己是地主
                util.alert('地主胜利，恭喜获胜');
            }else{
                util.alert('农民胜利，恭喜获胜');
            }
        }else if(winnerid == $scope.prevUser.userid){
            if($scope.prevRole=='role lanloader'){//上家是地主
                util.alert('农民失败，你太菜了');
            }else{
                if($scope.selfRole=='role lanloader'){
                    util.alert('地主失败，你太菜了');
                }else{
                    util.alert('农民胜利，恭喜获胜');
                }
            }
        }else if(winnerid == $scope.nextUser.userid){
            if($scope.nextRole=='role lanloader'){//上家是地主
                util.alert('农民失败，你太菜了');
            }else{
                if($scope.selfRole=='role lanloader'){
                    util.alert('地主失败，你太菜了');
                }else{
                    util.alert('农民胜利，恭喜获胜');
                }
            }
        }
        $scope.canCallLandloader = false;
        $scope.canplay = false;
        $scope.canPlayPokers = false;
        $scope.prevlastoutCards = [];
        $scope.nextlastoutCards = [];
        $scope.selflastoutCards = [];
        $scope.userInfo.isReadyToPlay = false;
        $scope.prevUser.isReadyToPlay = false;
        $scope.nextUser.isReadyToPlay = false;
        $scope.prevSkip = false;
        $scope.nextSkip = false;
        $scope.selfSkip = false;
        $scope.myturn = false;
        $scope.prevcards = [];
        $scope.nextcards = [];
        $scope.againstCardType = 0;
        $scope.eventTimeLimitLeft = undefined;
        $scope.eventTimeLimitRight = undefined;
        $scope.eventTimeLimit = undefined;
        $scope.skipTextPrev = '不要';
        $scope.skipTextSelf = '不要';
        $scope.skipTextNext = '不要';
        $scope.$apply();
    });


    //进入房间该执行的操作
	$scope.userInfo = $stateParams.userInfo;
    if($scope.userInfo.isReadyToPlay == "true"){
        $scope.userInfo.isReadyToPlay = true;
    }else{
        $scope.userInfo.isReadyToPlay = false;
    }

	if(!!$scope.userInfo.roomid){//如果有就是加入房间
		socket.emit('joinroom', $scope.userInfo, "room " + $scope.userInfo.roomid);
	}else{//没有就是创建房间
		socket.emit('createroom', $scope.userInfo);
	}
    //叫、抢 地主 不叫不抢
    $scope.callLandlord = function(boolean) {
        if(typeof boolean == 'undefined'){
            boolean = false;
        }
        if(!!$scope.timerSelf){
            $interval.cancel($scope.timerSelf);
            $scope.eventTimeLimit = -2;
        }
        socket.emit('calllandlord', boolean);
    }
    //准备 取消准备
	$scope.switchReady = function() {
        $scope.userInfo.isReadyToPlay = !$scope.userInfo.isReadyToPlay;
        socket.emit('readytoplay', $scope.userInfo);
    }
    //单牌
    $scope.isDanPai = function(outgoingCardsInorder){
        var isDanPai = true;
        var cards = outgoingCardsInorder;
        if(cards.length != 1){
            isDanPai = false;
        }
        return isDanPai;
    }
    //是不是对子
    $scope.isPair = function(outgoingCardsInorder){
        var isPair = true;
        var cards = outgoingCardsInorder;
        if(cards[0].cardValue != cards[1].cardValue){
            isPair = false;
        }else if(cards.length != 2){
            isPair = false;
        }
        return isPair;
    }
    //是不是王炸
    $scope.isJokers = function(outgoingCardsInorder){
        var isJokers = false;
        var cards = outgoingCardsInorder;
        if(cards.length==2 && cards[0].cardValue+cards[1].cardValue == 1999){
            isJokers = true;
        }
        return isJokers;
    }
    //是不是三不带
    $scope.isThreeWithNone = function(outgoingCardsInorder){
        var cards = outgoingCardsInorder;
        var size = cards.length;
        var isThreeWithNone = true;
        if(size != 3){
            isThreeWithNone = false;
        }else{
            if(cards[0].cardValue == cards[1].cardValue && cards[0].cardValue == cards[2].cardValue){
            }else{
                isThreeWithNone = false;
            }
        }
        return isThreeWithNone;
    }
    //是不是炸弹
    $scope.isBoom = function(outgoingCardsInorder){
        var isBoom = true;
        var cards = outgoingCardsInorder;
        if(cards.length!=4){
            isBoom = false;
        }else{
            if(!(cards[0].cardValue == cards[1].cardValue &&
                    cards[1].cardValue == cards[2].cardValue &&
                    cards[2].cardValue == cards[3].cardValue)){
                isBoom = false;
            }
        }
        return isBoom;
    }
    //判断是不是三带一
    $scope.isThreeWithOne = function(outgoingCardsInorder) { 
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
    //是不是三带二
    $scope.isThreeWithTwo = function(outgoingCardsInorder){
        var isThreeWithTwo = true;
        var cards = outgoingCardsInorder;
        if(cards.length != 5){
            isThreeWithTwo = false;
        }else{//排序后的三带二只有 xxxyy xxyyy
            if(cards[0].cardValue != cards[1].cardValue || cards[3].cardValue != cards[4].cardValue){
                isThreeWithTwo = false;
            }else{//确保了 xx*yy形式  *应该要=x 或者y才是三带二
                if(cards[2].cardValue != cards[1].cardValue && cards[2].cardValue != cards[4].cardValue){
                    isThreeWithTwo = false;
                }
            }
        }
        if(isThreeWithTwo){//额外功能 排个序 将yyxxx 变成 xxxyy
            if(cards[1].cardValue != cards[2].cardValue){//yyxxx
                outgoingCardsInorder.reverse();
            }
        }
        return isThreeWithTwo;
    }
    //是不是顺子
    $scope.isShunzi = function(outgoingCardsInorder){
        var cards = outgoingCardsInorder;
        var isShunzi = true;
        if(cards.length<5 || cards.length>12){
            isShunzi = false;
        }else{
            var size = cards.length;
            for (var i = 0; i < size-1 ; i++) {
                var _this = cards[i].cardValue*1;
                var _next = cards[i+1].cardValue*1;
                if(_this>=15 || _next >=15){//2-小王-大王不能在顺子里面
                    isShunzi = false;
                    break;
                }else{
                    if(_this-_next != 1){//说明不是连续的
                        isShunzi = false;
                        break;
                    }
                }
            }
        }
        if(isShunzi){//额外功能 排个序 变成 小->大 的顺子
            outgoingCardsInorder.reverse();
        }
        return isShunzi;
    }
    //是不是连对
    $scope.isPairsConnect = function(outgoingCardsInorder){
        var isPairsConnect = true;
        var cards = outgoingCardsInorder;
        var size = cards.length;
        if(size % 2 != 0 || size < 6){
            isPairsConnect = false;
        }else{
            for (var i = 0; i < (size/2 -1)  ; i++) {
                var one = cards[i*2].cardValue*1;
                var two = cards[i*2+1].cardValue*1;
                var nextone = cards[(i+1)*2].cardValue*1;
                var nexttwo = cards[(i+1)*2+1].cardValue*1;
                if(one == two && nextone == nexttwo){
                    if(one - nextone != 1){
                        isPairsConnect = false;
                        break;
                    }else if(one == 15 || two == 15 || nextone == 15 || nexttwo == 15){
                        isPairsConnect = false;
                        break;
                    }
                }else{
                    isPairsConnect = false;
                    break;
                }
            }
        }
        if(isPairsConnect){//额外功能 排个序 变成 小->大 的连对
            outgoingCardsInorder.reverse();
        }
        return isPairsConnect;
    }
    //是不是四带二
    $scope.isFourWithTwo = function(outgoingCardsInorder){
        var isFourWithTwo = true;
        var cards = outgoingCardsInorder;
        if(cards.length != 6){
            isFourWithTwo = false;
        }else{//xxxxyz yxxxxz yzxxxx
            if(cards[2].cardValue != cards[3].cardValue){
                isFourWithTwo = false;
            }else{//保证了是 **xx**
                if(cards[2].cardValue != cards[1].cardValue && cards[3].cardValue != cards[4].cardValue){
                    isFourWithTwo = false;
                }else{//确保了 *xxx** 或者**xxx*
                    if(cards[1].cardValue == cards[2].cardValue && cards[2].cardValue == cards[3].cardValue){//*xxx**
                        //第一个和第五个都不和234相等
                        if(cards[0].cardValue != cards[1].cardValue && cards[3].cardValue != cards[4].cardValue){
                            isFourWithTwo = false;
                        }
                    }else if(cards[2].cardValue == cards[3].cardValue && cards[3].cardValue == cards[4].cardValue){//**xxx*
                        if(cards[2].cardValue != cards[1].cardValue && cards[5].cardValue != cards[4].cardValue){
                            isFourWithTwo = false;
                        }
                    }else{
                        isFourWithTwo = false;
                    }
                }
            }
        }
        if(isFourWithTwo){//额外功能 排个序 变成xxxxyz 
            //处理 yxxxxz
            if(cards[0].cardValue != cards[1].cardValue && cards[4].cardValue != cards[5].cardValue){
                //将y shift 出来后 加入到数组中
                outgoingCardsInorder.push(outgoingCardsInorder.shift());
            }else if(cards[0].cardValue != cards[1].cardValue && cards[4].cardValue == cards[5].cardValue){//处理yzxxxx
                outgoingCardsInorder.reverse();
            }
        }
        return isFourWithTwo;
    }
    //飞机不带
    $scope.isPlaneWithNone = function(outgoingCardsInorder){
        var isPlaneWithNone = true;
        var cards = outgoingCardsInorder;
        var size = cards.length;
        if(size % 3 != 0){
            isPlaneWithNone = false;     
        }else{
            for (var i = 0; i < (size/3 -1)  ; i++) {
                var one = cards[i*3].cardValue*1;
                var two = cards[i*3+1].cardValue*1;
                var three = cards[i*3+2].cardValue*1;
                var nextone = cards[(i+1)*3].cardValue*1;
                var nexttwo = cards[(i+1)*3+1].cardValue*1;
                var nextthree = cards[(i+1)*3+2].cardValue*1;
                if(one == two && two == three && nextone == nexttwo && nexttwo == nextthree){
                    if(one - nextone != 1){
                        isPlaneWithNone = false;
                        break;
                    }
                }else{
                    isPlaneWithNone = false;
                    break;
                }
            }
        }
        if(isPlaneWithNone){//额外功能 排个序
            outgoingCardsInorder.reverse();
        }
        return isPlaneWithNone;
    }
    //飞机带单牌
    $scope.isPlaneWithSingle = function(outgoingCardsInorder){
        var isPlaneWithSingle = true;
        var cards = outgoingCardsInorder;
        var cardsCopy = cards.concat([]);
        var threeArr = [];
        var size = cards.length;
        if(size < 8 || size%4 != 0){
            isPlaneWithSingle = false;
        }else{//判断是否是3个的数量=单牌的数量
            var threeTimeArr = [];//出现3个时的序号
            for (var i = 0; i < size - 2 ; i++) {
                var one = cards[i].cardValue*1;
                var two = cards[i+1].cardValue*1;
                var three = cards[i+2].cardValue*1;
                if(one == two && two == three){
                    threeTimeArr.push(i);
                }
            }
            var ll = threeTimeArr.length;
            while(threeTimeArr.length>0){
                var index = threeTimeArr.pop();
                threeArr.concat(cardsCopy.splice(index,3));
            }
            //剩下的需要都是对子
            console.log("剩下的单牌们");
            console.log(cardsCopy);
            var singlesize = cardsCopy.length;
            //分离出来的三张
            console.log("分离出的三张");
            console.log(threeArr);

            //三张牌出现次数 == 剩余单牌张数
            if(ll != singlesize){
                isPlaneWithSingle = false;
            }else{
                if(!$scope.isPlaneWithNone(threeArr)){
                    isPlaneWithSingle = false;
                }
            }
        }
        if(isPlaneWithSingle){//排序成xxxyyyzd的格式
            outgoingCardsInorder = threeArr.concat(cardsCopy);
        }
        return isPlaneWithSingle
    }
    //飞机带对子
    $scope.isPlaneWithPair = function(outgoingCardsInorder){
        var isPlaneWithPair = true;
        var cards = outgoingCardsInorder;
        var cardsCopy = cards.concat([]);
        var threeArr = [];
        var size = cards.length;
        if(size < 10 || size%5 != 0){
            isPlaneWithPair = false;
        }else{//判断3个的数量 == 对子牌的数量
            var threeTimeArr = [];//出现3个时的序号
            for (let i = 0; i < size - 2 ; i++) {
                var one = cards[i].cardValue*1;
                var two = cards[i+1].cardValue*1;
                var three = cards[i+2].cardValue*1;
                if(one == two && two == three){
                    threeTimeArr.push(i);
                }
            }
            var ll = threeTimeArr.length;
            while(threeTimeArr.length>0){
                var index = threeTimeArr.pop();
                threeArr.concat(cardsCopy.splice(index,3));
            }
            //剩下的需要都是对子
            console.log("剩下的对子");
            console.log(cardsCopy);
            var pairsize = cardsCopy.length;
            //分离出来的三张
            console.log("分离出的三张");
            console.log(threeArr);
            //三张牌出现次数 == 剩余单牌张数
            if(pairsize%2!=0){
                isPlaneWithPair = false;
            }else{
                if(ll != pairsize/2){
                    isPlaneWithPair = false;
                }else if(!$scope.isPlaneWithNone(threeArr)){
                    isPlaneWithPair = false;
                }else{
                    for (var j = 0; j < pairsize/2 ; j++) {
                        var pairone = cardsCopy[j*2].cardValue*1;
                        var pairtwo = cardsCopy[j*2+1].cardValue*1;
                        if(pairone != pairtwo){
                            isPlaneWithPair = false;
                            break;
                        }
                    }
                }
            }
        }
        if(isPlaneWithPair){//排序成xxxyyyzzdd的格式
            outgoingCardsInorder = threeArr.concat(cardsCopy);
        }
        return isPlaneWithPair
    }
    //四带两对
    $scope.isFourWithTwoPair = function(outgoingCardsInorder){
        var isFourWithTwoPair = false;
        var cards = outgoingCardsInorder;
        if(cards.length == 8){//只有xxxxyyzz、yyxxxxzz、yyzzxxxx
            var v1 = cards[0].cardValue;
            var v2 = cards[1].cardValue;
            var v3 = cards[2].cardValue;
            var v4 = cards[3].cardValue;
            var v5 = cards[4].cardValue;
            var v6 = cards[5].cardValue;
            var v7 = cards[6].cardValue;
            var v8 = cards[7].cardValue;
            if(v1 == v2 && v2 == v3 && v3 == v4 && v5 == v6 && v7 == v8){//xxxxyyzz
                isFourWithTwoPair = true;
            }else if(v1 == v2 && v3 == v4 && v4 == v5 && v5 == v6 && v7 == v8){//yyxxxxzz
                isFourWithTwoPair = true;
                outgoingCardsInorder.push(outgoingCardsInorder.shift());//变成了yxxxxzzy
                outgoingCardsInorder.push(outgoingCardsInorder.shift());//变成了xxxxzzyy
            }else if(v1 == v2 && v3 == v4 && v5 == v6 && v6 == v7 && v7 == v8){//yyzzxxxx
                isFourWithTwoPair = true;
                outgoingCardsInorder.reverse();
            }
        }
        return isFourWithTwoPair;
    }
    //1单牌-2对子-3三不带-4顺子-5三带二-6连对-7四带二
    //8-飞机不带-9飞机带单牌-10飞机带对子-11四带二对-12三带一13炸弹-14王炸
    var cardRules = ['自己出牌','单牌','对子','三不带','顺子','三带二','连对','四带二','飞机不带','飞机带单牌','飞机带对子','四带二对','三带一','炸弹','王炸'];
    $scope.playRuleCheck = function(outgoingCards){
        outgoingCards = outgoingCards.sort(sortCards);
        var canout = -1;
        var length = outgoingCards.length;
        switch(length){
            case 1:
                if($scope.isDanPai(outgoingCards)){
                    //console.log("单牌："+canout);
                    canout = 1;
                };
                break;
            case 2:
                if($scope.isPair(outgoingCards)){
                    //console.log("对子");
                    canout = 2;
                }else if($scope.isJokers(outgoingCards)){
                    //console.log("王炸");
                    canout = 14;
                }else{
                    console.log("出牌不符合规范");
                }
                break;
            case 3:
                if($scope.isThreeWithNone(outgoingCards)){
                    //console.log("三不带");
                    canout = 3;
                }else{
                    console.log("出牌不符合规范");
                }
                break;
            case 4:
                if($scope.isBoom(outgoingCards)){
                    //console.log("炸弹");
                    canout = 13;
                }else if($scope.isThreeWithOne(outgoingCards)){
                    canout = 12;
                }else{
                    console.log("出牌不符合规范");
                }
                break;
            default:
                if($scope.isShunzi(outgoingCards)){
                    //console.log("顺子");
                    canout = 4;
                }else if($scope.isThreeWithTwo(outgoingCards)){
                    //console.log("三带二");
                    canout = 5;
                }else if($scope.isPairsConnect(outgoingCards)){
                    //console.log("连对");
                    canout = 6;
                }else if($scope.isFourWithTwo(outgoingCards)){
                    //console.log("四带二");
                    canout = 7;
                }else if($scope.isPlaneWithNone(outgoingCards)){
                    //console.log("飞机不带");
                    canout = 8;
                }else if($scope.isPlaneWithSingle(outgoingCards)){
                    //console.log("飞机带单牌");
                    canout = 9;
                }else if($scope.isPlaneWithPair(outgoingCards)){
                    //console.log("飞机带对子");
                    canout = 10;
                }else if($scope.isFourWithTwoPair(outgoingCards)){
                    //console.log("四带两对");
                    canout = 11;
                }else{
                    console.log("出牌不符合规范");
                }
        }
        return canout;
    }
    //点选牌(框选牌还未做)
    $scope.switchCardsStatus = function($event,card){
        $event.stopPropagation();
        var ele = $event.target;
        while(ele.className != 'card'){
            ele = ele.parentNode;
        }
        if(ele.offsetTop >0){
            ele.style.top = 0;
            card.isToPlayOut = true;
            ele.presentCard = card;//元素代表的牌
        }else{
            ele.style.top = "10%";
            card.isToPlayOut = false;
            ele.presentCard = undefined;
        }
    }


    //出牌 $scope.againstCardType 注意上家牌的类型
    $scope.outCards = function(){
        var outgoingCards = [];//将要打出的牌
        var cards = angular.element('#selfcard').find('span.card');
        angular.forEach(cards, function (cardEle) {
            if(!!cardEle.presentCard){
                outgoingCards.push(cardEle.presentCard);
            }
        });
        if(outgoingCards.length <= 0){//如果没选择牌出
            console.log('未选择牌 无法出牌');
            return;
        }
        var canout = this.playRuleCheck(outgoingCards);//检查牌是否符合规范
        if(canout<0){
            //提示用户出牌非法
        }else{
            //打牌
            var str = "";
            outgoingCards.forEach(function(card,j){
                str+=card.cardValue+"";
            });
            console.log("打牌："+str);
            socket.emit('outcards', {
                "fromid": $scope.userInfo.userid,
                "cards": outgoingCards,
                "cardsType": canout
            });
        }
    }
    //自动出牌
    $scope.autoOutCards = function(){
        var against = false;
        if($scope.againstCardType>0){
            against = true;
        }
        if(against){//是接上家出牌
            $scope.skipOver();
        }else{//自己打牌阶段没出牌
            socket.emit('outcards', {
                "fromid": $scope.userInfo.userid,
                "cards": [$scope.cards[$scope.cards.length-1]],
                "cardsType": 1
            });
        }
    }
    //pass过牌
    $scope.skipOver = function(){
        var cards = $scope.cards;
        cards.forEach(function(card,i){
            card.isToPlayOut = false;
        });
        var cardsEle = angular.element('#selfcard').find('span.card');
        angular.forEach(cardsEle, function (ele) {
            ele.style.top = "10%";
            ele.presentCard = undefined;
        });
        socket.emit('outcards', {
            "fromid": $scope.userInfo.userid,
            "cards": [],
            "cardsType": 0
        });
    }
    //提示 与 系统自动判定
    $scope.tipCards = function(){//判断自己有没有打得过的牌 isSysAuto 代表牌要不要突出出来
        var againstCard = $scope.againstCard;
        var againstCardType = $scope.againstCardType;
        var canornot = [];//默认打不过,没有牌 如果有打得过的 则变成一种可能性放在数组中
        var cards = $scope.cards;//自己的牌 注意本身是有顺序的
        switch(againstCardType*1){
            case 1://单牌
                var numInfo = {};
                var cardsCopy = cards.concat([]);
                for(var i = 3; i < 16; i++){//牌3-2的值;
                    numInfo[i] = [];
                }
                numInfo[999] = [];
                numInfo[1000] = [];
                while(cardsCopy.length>0){//记录每张牌的数量
                    var aCard = cardsCopy.pop();
                    if(aCard.cardValue > againstCard[0].cardValue){
                        numInfo[aCard.cardValue].push(aCard);
                    }
                }
                var fourArr = [];
                for(var key in numInfo){//找到一个牌值有4次出现的
                    if(numInfo[key].length == 4){
                        var tp = numInfo[key].concat([]);
                        tp.length = 1;
                        fourArr.unshift(tp);
                    }
                }
                var threeArr = [];
                for(var key in numInfo){//找到一个牌值有3次出现的
                    if(numInfo[key].length == 3){
                        var tp = numInfo[key].concat([]);
                        tp.length = 1;
                        threeArr.unshift(tp);
                    }
                }
                var twoArr = [];
                for(var key in numInfo){//找到一个牌值有2次出现的
                    if(numInfo[key].length == 2){
                        var tp = numInfo[key].concat([]);
                        tp.length = 1;
                        twoArr.unshift(tp);
                    }
                }
                var oneArr = [];
                for(var key in numInfo){//找到一个牌值有1次出现的
                    if(numInfo[key].length == 1){
                        var tp = numInfo[key].concat([]);
                        oneArr.unshift(tp);
                    }
                }
                canornot = fourArr.concat(threeArr.concat(twoArr.concat(oneArr)));
                break;
            case 2://对子
                var numInfo = {};
                var cardsCopy = cards.concat([]);
                for(var i = 3; i < 16; i++){//牌3-2的值;
                    numInfo[i] = [];
                }
                while(cardsCopy.length>0){//记录每张牌的数量
                    var aCard = cardsCopy.pop();
                    if(aCard.cardValue <= 15 && aCard.cardValue > againstCard[0].cardValue){
                        numInfo[aCard.cardValue].push(aCard);
                    }
                }
                var fourArr = [];
                for(var key in numInfo){//找到一个牌值有4次出现的
                    if(numInfo[key].length == 4){
                        var tp = numInfo[key].concat([]);
                        tp.length = 2;
                        fourArr.unshift(tp);
                    }
                }
                var threeArr = [];
                for(var key in numInfo){//找到一个牌值有3次出现的
                    if(numInfo[key].length == 3){
                        var tp = numInfo[key].concat([]);
                        tp.length = 2;
                        threeArr.unshift(tp);
                    }
                }
                var twoArr = [];
                for(var key in numInfo){//找到一个牌值有2次出现的
                    if(numInfo[key].length == 2){
                        var tp = numInfo[key].concat([]);
                        tp.length = 2;
                        twoArr.unshift(tp);
                    }
                }
                canornot = fourArr.concat(threeArr.concat(twoArr));
                break;
            case 3://三不带
                var numInfo = {};
                var cardsCopy = cards.concat([]);
                for(var i = 3; i < 16; i++){//牌3-2的值;
                    numInfo[i] = [];
                }
                while(cardsCopy.length>0){//记录每张牌的数量
                    var aCard = cardsCopy.pop();
                    if(aCard.cardValue > againstCard[0].cardValue){
                        numInfo[aCard.cardValue].push(aCard);
                    }
                }
                for(var key in numInfo){//找到一个牌值有4次出现的
                    if(numInfo[key].length == 4){
                        var tp = numInfo[key].concat([]);
                        tp.length = 2;
                        canornot.push(tp);
                    }
                }
                for(var key in numInfo){//找到一个牌值有3次出现的
                    if(numInfo[key].length == 3){
                        var tp = numInfo[key].concat([]);
                        tp.length = 2;
                        canornot.push(tp);
                    }
                }
                break;
            case 4://顺子
                var againstCardNum = againstCard.length;
                var againstCardValMax = againstCard[againstCardNum-1].cardValue*1;//顺子的最大值
                var againstCardValMin = againstCard[0].cardValue*1;//顺子的最小值

                var numInfo = {};
                var cardsCopy = cards.concat([]);
                for(var i = 3; i < 15; i++){//牌3-A的值;
                    numInfo[i] = [];
                }
                while(cardsCopy.length>0){//记录每张牌的数量
                    var aCard = cardsCopy.pop();
                    if(aCard.cardValue<=14){//顺子只能到A
                        numInfo[aCard.cardValue].push(aCard);
                    }
                }
                var oneArr = [];
                for(var key in numInfo){//找到一个牌值有1次以上出现的
                    if(numInfo[key].length != 0){//只要出现过1次
                        numInfo[key].length = 1;
                        oneArr = oneArr.concat(numInfo[key]);
                    }
                }
                if(oneArr.length>0){
                    oneArr.sort(sortCards);
                    var dindex = oneArr.length - againstCard.length;//差值
                    if(dindex>=0){//错开差值比较 一次错开一位
                        var startIndex = 0;
                        for (var i = 0; i <= dindex; i++) {
                            var aTry = oneArr.concat([]).splice(startIndex,againstCard.length);
                            if($scope.isShunzi(aTry) && aTry[0].cardValue>againstCardValMin){
                                canornot.push(aTry);
                            }
                            startIndex++;
                        }
                    }
                }
                break;
            case 5://三带二
                //找出三张的 找出对子 组合 三张的值要大于别人的牌
                var numInfo = {};
                var cardsCopy = cards.concat([]);
                for(var i = 3; i < 16; i++){//牌3-2的值;
                    numInfo[i] = [];
                }
                while(cardsCopy.length>0){//记录每张牌的数量
                    var aCard = cardsCopy.pop();
                    if(aCard.cardValue<=15){
                        numInfo[aCard.cardValue].push(aCard);
                    }
                }
                var twoArr = [];
                var threeArr = [];
                for(var key in numInfo){//找到一个牌值有3次出现的
                    if(numInfo[key].length >= 2){//对子
                        var tp = numInfo[key].concat([]);
                        tp.length = 2;
                        twoArr.push(tp);
                    }
                    if(numInfo[key].length >= 3 && key>againstCard[0].cardValue){//三张
                        var tp = numInfo[key].concat([]);
                        tp.length = 3;
                        threeArr.push(tp);
                    }
                }
                if(threeArr.length>0 && twoArr.length>0){
                    twoArr.reverse();
                    threeArr.reverse();
                    threeArr.forEach(function(athreeArr,i){
                        var aTry = athreeArr;
                        twoArr.forEach(function(atwoArr,j){
                            if(athreeArr[0].cardValue!=atwoArr[0].cardValue){
                                canornot.push(aTry.concat(atwoArr));
                            }
                        });
                    });
                }
                break;
            case 6://连对
                //找出对子排序
                var numInfo = {};
                var cardsCopy = cards.concat([]);
                for(var i = 3; i < 16; i++){//牌3-2的值;
                    numInfo[i] = [];
                }
                while(cardsCopy.length>0){//记录每张牌的数量
                    var aCard = cardsCopy.pop();
                    if(aCard.cardValue<=14){//连对只能到A
                        numInfo[aCard.cardValue].push(aCard);
                    }
                }
                var twoArr = [];
                for(var key in numInfo){//找到一个牌值有2次出现的
                    if(numInfo[key].length >= 2){//对子
                        numInfo[key].length = 2;//大于2张的牌只保留2张
                        twoArr = twoArr.concat(numInfo[key]);
                    }
                }
                if(twoArr.length>0){
                    twoArr.sort(sortCards);
                    var dindex = twoArr.length - againstCard.length;//差值
                    if(dindex>=0){//错开差值比较 一次错开一位
                        var startIndex = 0;
                        for (var i = 0; i <= dindex; i=i+2) {
                            var aTry = twoArr.concat([]).splice(startIndex,againstCard.length);
                            if($scope.isPairsConnect(aTry)){
                                canornot.push(aTry);
                            }
                            startIndex = startIndex+2;
                        }
                    }
                }
                canornot.reverse();
                break;
            case 7://四带二
                var size = cards.length;
                var numInfo = {};
                var cardsCopy = cards.concat([]);
                for(var i = 3; i < 16; i++){//牌3-2的值;
                    numInfo[i] = [];
                }
                while(cardsCopy.length>0){//记录每张牌的数量
                    var aCard = cardsCopy.pop();
                    if(aCard.cardValue<=15){//
                        numInfo[aCard.cardValue].push(aCard);
                    }
                }
                var fourArr = [];
                for(var key in numInfo){//找到一个牌值有3次出现的
                    if(numInfo[key].length == 4 && key>againstCard[0].cardValue){//4张
                        fourArr.push(numInfo[key]);
                    }
                }
                if(fourArr.length>0 && oneArr.length>0){
                    fourArr.forEach(function(afourArr,k){
                        var cardsCopy = cards.concat([]);
                        var afourArrCopy = afourArr.concat([]);
                        while(afourArrCopy.length>0){
                            var aCard = afourArrCopy.pop();
                            var toDelIndex = -1;
                            cardsCopy.forEach(function(card,j){
                                //只要值=就删这样可以避免四张的情况
                                if(card.cardValue == aCard.cardValue){
                                    toDelIndex = j;
                                }
                            });
                            if(toDelIndex>0){
                                cardsCopy.splice(toDelIndex,1);
                            }
                        }
                        //剔除了四张中牌后剩下的牌
                        var sizeleft = cardsCopy.length;
                        var planeNum = 2;
                        for (var i = sizeleft-(planeNum); i >= 0; i--) {
                            var tempAr = [];
                            var planeNumIndex = planeNum;
                            while(planeNumIndex>0){
                                tempAr.push(cardsCopy[sizeleft-planeNumIndex-i]);
                                planeNumIndex--;
                            }
                            var aTry = afourArr.concat(tempAr);
                            canornot.push(aTry);
                        }
                    });
                }
                break;
            case 8://飞机不带
                //找出三张的 找出对子 组合 三张的值要大于别人的牌
                var numInfo = {};
                var cardsCopy = cards.concat([]);
                for(var i = 3; i < 16; i++){//牌3-2的值;
                    numInfo[i] = [];
                }
                while(cardsCopy.length>0){//记录每张牌的数量
                    var aCard = cardsCopy.pop();
                    if(aCard.cardValue<=14){
                        numInfo[aCard.cardValue].push(aCard);
                    }
                }
                var threeArr = [];
                for(var key in numInfo){//找到一个牌值有3次出现的
                    if(numInfo[key].length >= 3 && key>againstCard[0].cardValue){//三张
                        numInfo[key].length = 3;
                        threeArr = threeArr.concat(numInfo[key]);
                    }
                }
                if(threeArr.length>0){
                    var againstsize = 3*againstCard.length/3;//所有三张的牌的数量
                    var size = threeArr.length;
                    var againstCardValMin = againstCard[0].cardValue;
                    for (var i = 0; i<=size-againstsize ; i++) {
                        var cardsCopy = threeArr.concat([]);
                        var aTry = cardsCopy.splice(i,againstsize).reverse();
                        if(aTry[0].cardValue>againstCardValMin && $scope.isPlaneWithNone(aTry)){
                            canornot.push(aTry);
                        }
                    }
                }
                break;
            case 9://飞机带单牌
                var planeArrTry = [];
                var numInfo = {};
                var cardsCopy = cards.concat([]);
                for(var i = 3; i < 16; i++){//牌3-2的值;
                    numInfo[i] = [];
                }
                while(cardsCopy.length>0){//记录每张牌的数量
                    var aCard = cardsCopy.pop();
                    if(aCard.cardValue<=14){
                        numInfo[aCard.cardValue].push(aCard);
                    }
                }
                var threeArr = [];
                for(var key in numInfo){//找到一个牌值有3次出现的
                    if(numInfo[key].length >= 3 && key>againstCard[0].cardValue){//三张
                        numInfo[key].length = 3;
                        threeArr = threeArr.concat(numInfo[key]);
                    }
                }
                if(threeArr.length>0){
                    var againstsize = 3*againstCard.length/4;//所有三张的牌的数量
                    var size = threeArr.length;
                    var againstCardValMin = againstCard[0].cardValue;
                    for (var i = 0; i<=size-againstsize ; i++) {
                        var cardsCopy = threeArr.concat([]);
                        var aTry = cardsCopy.splice(i,againstsize).reverse();
                        if(aTry[0].cardValue>againstCardValMin && $scope.isPlaneWithNone(aTry)){
                            planeArrTry.push(aTry);
                        }
                    }
                }
                //planeArrTry里面是所有的飞机不带的可能
                if(planeArrTry.length>0){
                    planeArrTry.forEach(function(aPlaneArr,i){
                        var cardsCopy = cards.concat([]);
                        var aPlaneArrCopy = aPlaneArr.concat([]);
                        while(aPlaneArrCopy.length>0){
                            var aCard = aPlaneArrCopy.pop();
                            var toDelIndex = -1;
                            cardsCopy.forEach(function(card,j){
                                //只要值=就删这样可以避免四张的情况
                                if(card.cardValue == aCard.cardValue){
                                    toDelIndex = j;
                                }
                            });
                            if(toDelIndex>0){
                                cardsCopy.splice(toDelIndex,1);
                            }
                        }
                        //剔除了飞机中牌后剩下的牌
                        var sizeleft = cardsCopy.length;
                        var planeNum = aPlaneArr/3;//飞机是几张飞
                        for (var i = sizeleft-(planeNum); i >= 0; i--) {
                            var tempAr = [];
                            var planeNumIndex = planeNum;
                            while(planeNumIndex>0){
                                tempAr.push(cardsCopy[sizeleft-planeNumIndex-i]);
                                planeNumIndex--;
                            }
                            var aTry = aPlaneArr.concat(tempAr);
                            canornot.push(aTry);
                        }
                    });
                    canornot.reverse();
                }
                break;
            case 10://飞机带对子
                var planeArrTry = [];
                var numInfo = {};
                var cardsCopy = cards.concat([]);
                for(var i = 3; i < 16; i++){//牌3-2的值;
                    numInfo[i] = [];
                }
                while(cardsCopy.length>0){//记录每张牌的数量
                    var aCard = cardsCopy.pop();
                    if(aCard.cardValue<=14){
                        numInfo[aCard.cardValue].push(aCard);
                    }
                }
                var twoArr = [];
                var threeArr = [];
                for(var key in numInfo){//找到一个牌值有3次出现的
                    if(numInfo[key].length >= 2){
                        var tp = numInfo[key].concat([]);
                        tp.length = 2;
                        twoArr.push(tp);
                    }
                    if(numInfo[key].length >= 3 && key>againstCard[0].cardValue){//三张
                        numInfo[key].length = 3;
                        threeArr = threeArr.concat(numInfo[key]);
                    }
                    
                }
                if(threeArr.length>0){
                    var againstsize = 3*againstCard.length/5;//所有三张的牌的数量
                    var size = threeArr.length;
                    var againstCardValMin = againstCard[0].cardValue;
                    for (var i = 0; i<=size-againstsize ; i++) {
                        var cardsCopy = threeArr.concat([]);
                        var aTry = cardsCopy.splice(i,againstsize).reverse();
                        if(aTry[0].cardValue>againstCardValMin && $scope.isPlaneWithNone(aTry)){
                            planeArrTry.push(aTry);
                        }
                    }
                }
                //planeArrTry里面是所有的飞机不带的可能 twoArr是所有可能的对子
                if(planeArrTry.length>0 && twoArr.length>=2){//至少要有2对
                    var total = twoArr.length;
                    planeArrTry.forEach(function(aPlaneArr,c){
                        for (var i = 0; i < total; i++) {
                            var aPair = twoArr[i];
                            var isInaPlaneArr = false;
                            for (var k = 0; k < aPlaneArr.length; k++) {
                                if(aPlaneArr[k].cardValue == aPair[0].cardValue){
                                    isInaPlaneArr = true;
                                    break;
                                }
                            }
                            if(isInaPlaneArr){
                                break;
                            }
                            for (var j = i+1; j < total; j++) {
                                var twoPair = twoArr[j];
                                var isInaPlaneArrTwo = false;
                                for (var k = 0; k < aPlaneArr.length; k++) {
                                    if(aPlaneArr[k].cardValue == twoPair[0].cardValue){
                                        isInaPlaneArrTwo = true;
                                        break;
                                    }
                                }
                                if(!isInaPlaneArrTwo){//说明满足条件
                                    var aPlaneArrCopy = aPlaneArr.concat([]);
                                    var aPairCopy = aPair.concat([]);
                                    while(aPairCopy.length>0){
                                        aPlaneArrCopy.push(aPairCopy.pop());
                                    }
                                    var twoPairCopy = twoPair.concat([]);
                                    while(twoPairCopy.length>0){
                                        aPlaneArrCopy.push(twoPairCopy.pop());
                                    }
                                    canornot.push(aPlaneArrCopy);
                                }
                            }
                        }
                    });
                }
                break;
            case 11://四带二对
                var numInfo = {};
                var canFourArr = []
                var cardsCopy = cards.concat([]);
                for(var i = 3; i < 16; i++){//牌3-2的值;
                    numInfo[i] = [];
                }
                while(cardsCopy.length>0){//记录每张牌的数量
                    var aCard = cardsCopy.pop();
                    if(aCard.cardValue<=15){
                        numInfo[aCard.cardValue].push(aCard);
                    }
                }
                var twoArr = [];
                for(var key in numInfo){//找到一个牌值有4次出现的
                    if(numInfo[key].length == 4 && key>againstCard[0].cardValue){//4张
                        canFourArr.push(numInfo[key]);
                    }
                    if(numInfo[key].length >= 2){
                        var tp = numInfo[key].concat([]);
                        tp.length = 2;
                        twoArr.push(tp);
                    }
                }
                if(canFourArr.length>0 && twoArr.length>=2){//至少要有2对
                    var total = twoArr.length;
                    canFourArr.forEach(function(aFour,c){
                        for (var i = 0; i < total; i++) {
                            var aPair = twoArr[i];
                            if(aFour[0].cardValue == aPair[0].cardValue){
                                break;
                            }
                            for (var j = i+1; j < total; j++) {
                                var twoPair = twoArr[j];
                                if(aFour[0].cardValue == twoPair[0].cardValue){
                                    break;
                                }
                                //说明满足条件
                                var aFourArrCopy = aFour.concat([]);
                                var aPairCopy = aPair.concat([]);
                                while(aPairCopy.length>0){
                                    aFourArrCopy.push(aPairCopy.pop());
                                }
                                var twoPairCopy = twoPair.concat([]);
                                while(twoPairCopy.length>0){
                                    aFourArrCopy.push(twoPairCopy.pop());
                                }
                                canornot.push(aFourArrCopy);
                            }
                        }
                    });
                }
                break;
            case 12://三带一
                //找出三张的 找出单张 组合 三张的值要大于别人的牌
                var numInfo = {};
                var cardsCopy = cards.concat([]);
                for(var i = 3; i < 16; i++){//牌3-2的值;
                    numInfo[i] = [];
                }
                while(cardsCopy.length>0){//记录每张牌的数量
                    var aCard = cardsCopy.pop();
                    if(aCard.cardValue<=15){
                        numInfo[aCard.cardValue].push(aCard);
                    }
                }
                var oneArr = [];
                var threeArr = [];
                for(var key in numInfo){//找到一个牌值有3次出现的
                    if(numInfo[key].length >= 1){//对子
                        var tp = numInfo[key].concat([]);
                        tp.length = 1;
                        oneArr.push(tp);
                    }
                    if(numInfo[key].length >= 3 && key>againstCard[0].cardValue){//三张
                        var tp = numInfo[key].concat([]);
                        tp.length = 3;
                        threeArr.push(tp);
                    }
                }
                if(threeArr.length>0 && oneArr.length>0){
                    oneArr.reverse();
                    threeArr.forEach(function(athreeArr,i){
                        var aTry = athreeArr;
                        oneArr.forEach(function(aArr,j){
                            if(athreeArr[0].cardValue!=aArr[0].cardValue){
                                canornot.push(aTry.concat(aArr));
                            }
                        });
                    });
                }
                break;
            case 13://炸弹
                var numInfo = {};
                var cardsCopy = cards.concat([]);
                for(var i = 3; i < 16; i++){//牌3-2的值;
                    numInfo[i] = [];
                }
                while(cardsCopy.length>0){//记录每张牌的数量
                    var aCard = cardsCopy.pop();
                    if(aCard.cardValue<=15){
                        numInfo[aCard.cardValue].push(aCard);
                    }
                }
                for(var key in numInfo){//找到一个牌值有4次出现的
                    if(numInfo[key].length == 4 && key>againstCard[0].cardValue){//4张
                        canornot.push(numInfo[key]);
                    }
                }
                break;
            case 14://王炸
                break;
        }
        if(againstCardType*1 <=12 ){//按规则的 要多判断下炸弹和王炸
            var numInfo = {};
            var cardsCopy = cards.concat([]);
            for(var i = 3; i < 16; i++){//牌3-2的值;
                numInfo[i] = [];
            }
            while(cardsCopy.length>0){//记录每张牌的数量
                var aCard = cardsCopy.pop();
                if(aCard.cardValue<=15){
                    numInfo[aCard.cardValue].push(aCard);
                }
            }
            for(var key in numInfo){//找到一个牌值有3次出现的
                if(numInfo[key].length == 4){//4张
                    canornot.unshift(numInfo[key]);
                }
            }
            if(cards.length>=2&&cards[0].cardValue+cards[1].cardValue == 1999){
                canornot.unshift([cards[0],cards[1]]);
            }
        }else if(againstCardType*1 == 12){//按炸弹 要多判断下王炸
            if(cards.length>=2&&cards[0].cardValue+cards[1].cardValue == 1999){
                canornot.unshift([cards[0],cards[1]]);
            }
        }
        if(canornot.length<=0){//真的没有大得过的
            // console.log("没有牌大得过");
        }
        return canornot;
    }

    $scope.posibleCards = [];
    $scope.tip = function(){
        if($scope.posibleCards.length>0){
            var posible = $scope.posibleCards.pop();//获得一种方案
            //显示到页面
            var cards = $scope.cards;
            cards.forEach(function(card,i){
                card.isToPlayOut = false;
            });
            var cardsEle = angular.element('#selfcard').find('span.card');
            angular.forEach(cardsEle, function (ele) {
                ele.style.top = "10%";
                ele.presentCard = undefined;
            });

            posible.forEach(function(posibleCard,j){
                for (var i = 0; i < cards.length; i++) {
                    if(posibleCard.cardValue == cards[i].cardValue &&
                        posibleCard.cardType == cards[i].cardType){
                        var cardele = angular.element('#'+cards[i].cardValue+cards[i].cardType)[0];
                        cardele.style.top = 0;
                        cards[i].isToPlayOut = true;
                        cardele.presentCard = cards[i];//元素代表的牌
                        break;
                    }
                }
            });
        }else{
            $scope.posibleCards = $scope.tipCards().concat([]);
            if($scope.posibleCards.length>0){
                var posible = $scope.posibleCards.pop();//获得一种方案
                //显示到页面
                var cards = $scope.cards;
                cards.forEach(function(card,i){
                    card.isToPlayOut = false;
                });
                var cardsEle = angular.element('#selfcard').find('span.card');
                angular.forEach(cardsEle, function (ele) {
                    ele.style.top = "10%";
                    ele.presentCard = undefined;
                });

                posible.forEach(function(posibleCard,j){
                    for (var i = 0; i < cards.length; i++) {
                        if(posibleCard.cardValue == cards[i].cardValue &&
                            posibleCard.cardType == cards[i].cardType){
                            var cardele = angular.element('#'+cards[i].cardValue+cards[i].cardType)[0];
                            cardele.style.top = 0;
                            cards[i].isToPlayOut = true;
                            cardele.presentCard = cards[i];//元素代表的牌
                            break;
                        }
                    }
                });
            }else{
                $scope.skipOver();
            }
        }
    }

    //一项操作的倒计时
    $scope.newEventSelf = function(time,callback){
        time = time*1+1;
        $scope.eventTimeLimit = time;
        $scope.timerSelf = $interval( function(){
            $scope.eventTimeLimit--;
            // console.log($scope.eventTimeLimit)
            if($scope.eventTimeLimit == -1){
                if(typeof callback == "function"){
                    callback();
                }
                $scope.timerSelf = null;
            }
        }, 1000,time+1);
    }
    //一项操作的倒计时
    $scope.newEventLeft = function(time,callback){
        time = time*1+1;
        $scope.eventTimeLimitLeft = time;
        $scope.timerLeft = $interval( function(){
            $scope.eventTimeLimitLeft--;
            // console.log($scope.eventTimeLimitLeft)
            if($scope.eventTimeLimitLeft == -1){
                if(typeof callback == "function"){
                    callback();
                }
                $scope.timerLeft = null;
            }
        }, 1000,time+1);
    }
    //一项操作的倒计时
    $scope.newEventRight = function(time,callback){
        time = time*1+1;
        $scope.eventTimeLimitRight = time;
        $scope.timerRight = $interval( function(){
            $scope.eventTimeLimitRight--;
            // console.log($scope.eventTimeLimitRight)
            if($scope.eventTimeLimitRight == -1){
                if(typeof callback == "function"){
                    callback();
                }
                $scope.timerRight = null;
            }
        }, 1000,time+1);
    }

    var leaveRoom = function() {
        socket.emit('leaveroom');
    }

    $scope.leave = function(){
        if($scope.canplay){
            util.confirm('离开将会由笨笨的机器人代打',function(){
                clearAll();
                leaveRoom();
            },['离开','取消']);
        }else{
            clearAll();
            leaveRoom();
        }
    }
    window.$scope = $scope;
}]);