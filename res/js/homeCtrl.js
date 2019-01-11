App.controller('homeCtrl', ['$rootScope','$scope', '$stateParams', '$state', 'socket','util', function($rootScope,$scope, $stateParams, $state, socket,util) {
    $scope.userInfo = $stateParams.userInfo; //登录页面传过来的参数
    console.log($stateParams);
    //创建房间
    $scope.makeRoom = function() {
        if(!$rootScope.inWhichRoom){
            $scope.userInfo.roomid = null;
            $state.go('room', {userInfo:$scope.userInfo});
        }else{
            util.confirm('您当前在房间'+$scope.inWhichRoom+'对局,是否立即前往？',function(){
                //
            },['立即前往','暂不进入']);
        }
    }
    //加入房间
    $scope.joinRoom = function() {
        // socket.emit('joinroom', $scope.userInfo, "room " + roomid);
        var roomid = window.prompt("请输入房间号", "");
        if (roomid != null && roomid != "") {
            $scope.userInfo.roomid = roomid * 1;
            //$location.path('/room').search($scope.userInfo);
            $state.go('room', {userInfo:$scope.userInfo});
        }
    }
    //天梯匹配
    $scope.speedAuto = function() {
        //暂不实现
    }

    
}]);