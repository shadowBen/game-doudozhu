App.factory('socket', function($rootScope) {
    return {
        on: function(eventName, callback) {
            window.socket.on(eventName, function() {
                let _this = this;
                callback.apply(_this, arguments);
            });
        },
        emit: function(eventName, data, callback) {
            window.socket.emit(eventName, data, callback);
        },
        removeAllListeners: function(array) {
            window.socket.removeAllListeners(array);
        }
    };
});
App.factory('util', function($rootScope) {
    return {
        alert: function(title) {
            window.layer.open({
                content: title,
                shadeClose: false,
                btn: '确定'
            });
        },
        confirm: function(title, callback, btnArr) {
            window.layer.open({
                content: title,
                btn: btnArr || ['确定', '取消'],
                shadeClose: false,
                yes: function(index) {
                    window.layer.close(index);
                    let _this = this;
                    callback.apply(_this, arguments);
                }
            });
        }
    };
});

App.directive("avator", function($rootScope) {
    return {
        restrict: 'A',
        scope: false,
        replace: false,
        template: function(elem, attr) {
            var h = elem[0].offsetHeight;
            var w = elem[0].offsetWidth;
            if (w > h) {
                elem[0].style.width = h + "px";
                if (elem[0].parentNode) {
                    elem[0].parentNode.style.textAlign = "center";
                }
            }
        }
    };
});