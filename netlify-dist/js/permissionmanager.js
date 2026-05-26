(function () {
    var noop = function () {};
    window.permissionManager = {
        currentUser: null,
        setCurrentUser: function (u) {
            this.currentUser = u || null;
        },
        logout: function () {
            this.currentUser = null;
        },
        logAudit: function (action, meta) {
            try {
                console.info('[audit]', action, meta || {});
            } catch (e) {
                noop();
            }
        },
        canDelete: function () {
            return true;
        },
        canModify: function () {
            return true;
        },
        canView: function () {
            return true;
        }
    };
})();
