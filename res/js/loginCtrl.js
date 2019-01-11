App.controller('loginCtrl', ['$rootScope','$scope', '$stateParams', 'socket', '$state', function($rootScope,$scope, $stateParams, socket, $state) {
    console.log(socket); // Object {name: "zhangsan", id: "12"}
    $scope.wxlogin = function(){
    }
    $scope.login = function(){
    	var current = new Date().getTime();
    	var userInfo = {
	        username: window.user,
	        userid: window.user,
	        isReadyToPlay: false,
	        avatar: "./res/assets/"+window.user+".jpg",
	        userip: "192.168.20.2"
	    };//游客
    	socket.on('logined', function(data) {
            $scope.userInfo = userInfo;//游客
            $scope.loginedUserNum = data;//在线人数
            $state.go('home', {userInfo:$scope.userInfo});
            $scope.$apply();
        });
    	socket.emit('login', userInfo);
    }
    socket.on('alreadyLogin',function(roomid){
        if(!!roomid){
            $rootScope.inWhichRoom = roomid;
        }else if(roomid == -1){//表示登录未进入房间被挤掉线
            $state.go('login');
        }else{
            $rootScope.inWhichRoom = undefined;
        }
    })
}]);