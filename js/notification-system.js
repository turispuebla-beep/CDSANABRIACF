/**
 * ðŸ”” SISTEMA DE NOTIFICACIONES EN TIEMPO REAL - CDSANABRIACF
 * ComunicaciÃ³n entre entrenadores, equipo, administradores, socios y amigos del club
 * Integrado con Firebase para sincronizaciÃ³n en tiempo real
 */

console.log('ðŸ”” Iniciando sistema de notificaciones CD Sanabria CF...');

class ClubNotificationSystem {
    constructor() {
        this.notifications = [];
        this.subscribers = [];
        this.currentUser = null;
        this.userRole = 'guest';
        this.firebaseInitialized = false;
        this.fcmToken = null;
        this._fcmForegroundListenerAttached = false;
        this._fcmSetupComplete = false;
        
        this.init();
    }

    async init() {
        await this.loadCurrentUser();
        await this.setupFirebaseIntegration();
        this.setupPushNotifications();
        this.setupEmailNotifications();
        this.setupRealTimeListeners();
        this.loadNotificationsForUser();
        console.log('ðŸ”” Sistema de notificaciones CD Sanabria CF inicializado');
    }

    // Cargar usuario actual
    async loadCurrentUser() {
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
                this.userRole = this.currentUser.role || 'member';
                console.log('ðŸ‘¤ Usuario cargado:', this.currentUser.email, 'Rol:', this.userRole);
            }
        } catch (error) {
            console.error('âŒ Error cargando usuario:', error);
        }
    }

    // Configurar integraciÃ³n con Firebase
    async setupFirebaseIntegration() {
        try {
            // Verificar si Firebase estÃ¡ disponible
            if (window.firebaseDb && !window.firebaseDb.isSimulation) {
                this.firebaseInitialized = true;
                console.log('ðŸ”¥ Firebase configurado para notificaciones');
                
                // Configurar Cloud Messaging
                await this.setupCloudMessaging();
                
                // Configurar listeners en tiempo real
                await this.setupFirebaseListeners();
            } else {
                console.log('ðŸ”¥ Usando modo simulaciÃ³n para notificaciones');
                this.setupSimulatedNotifications();
            }
        } catch (error) {
            console.error('âŒ Error configurando Firebase:', error);
            this.setupSimulatedNotifications();
        }
    }

    // Configurar Cloud Messaging (permiso: al cargar puede fallar en móvil sin gesto; usar solicitarPermisoNotificacionesNavegador())
    async setupCloudMessaging() {
        try {
            if (this._fcmSetupComplete) return;
            if (!window.firebaseMessaging || window.firebaseMessaging.isSimulation) return;
            if (!('Notification' in window)) return;

            let permission = Notification.permission;
            if (permission !== 'granted') {
                permission = await Notification.requestPermission();
            }
            if (permission !== 'granted') {
                console.log('📵 Permiso de notificaciones no concedido:', permission);
                return;
            }

            const { getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging.js');
            const token = await getToken(window.firebaseMessaging, {
                vapidKey: 'BK6QOHZGAPCgqsDEtjGfIST2F5G0t6ICn7Gn-nZksTEwqxd6A8w9yb7YNlHqQimbhqmrRWigHTy1DIAXfbN0LFQ'
            });

            this.fcmToken = token;
            console.log('🔔 Token FCM obtenido correctamente');
            await this.saveUserToken(token);

            if (!this._fcmForegroundListenerAttached) {
                onMessage(window.firebaseMessaging, (payload) => {
                    console.log('ðŸ”” Mensaje FCM recibido:', payload);
                    this.handleFirebaseMessage(payload);
                });
                this._fcmForegroundListenerAttached = true;
            }
            this._fcmSetupComplete = true;
        } catch (error) {
            console.error('âŒ Error configurando Cloud Messaging:', error);
        }
    }

    /**
     * Llamar desde un clic del usuario (p. ej. botón "Permitir avisos").
     * En móvil el navegador suele mostrar el diálogo nativo solo tras un gesto.
     */
    async solicitarPermisoNotificacionesNavegador() {
        if (!('Notification' in window)) {
            return 'unsupported';
        }
        if (Notification.permission === 'denied') {
            return 'denied';
        }
        if (Notification.permission === 'granted' && this._fcmSetupComplete) {
            return 'granted';
        }
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            this._fcmSetupComplete = false;
            await this.setupCloudMessaging();
            this.showWelcomeNotification();
        }
        return permission;
    }

    // Guardar token del usuario
    async saveUserToken(token) {
        try {
            if (this.currentUser && this.firebaseInitialized) {
                await window.updateDocument('users', this.currentUser.id, {
                    fcmToken: token,
                    lastTokenUpdate: new Date().toISOString()
                });
                console.log('âœ… Token guardado en Firestore');
            }
        } catch (error) {
            console.error('âŒ Error guardando token:', error);
        }
    }

    // Configurar listeners de Firebase en tiempo real
    async setupFirebaseListeners() {
        if (!this.firebaseInitialized) return;
        
        try {
            const { collection, query, where, orderBy, limit, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');
            const notificationsCollection = window.DB_COLLECTIONS?.NOTIFICATIONS || 'sanabria_notifications';
            // Escuchar notificaciones del club
            const notificationsRef = collection(window.firebaseDb, notificationsCollection);
            const q = query(notificationsRef, 
                where('targetRoles', 'array-contains', this.userRole),
                orderBy('timestamp', 'desc'),
                limit(50)
            );
            
            onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const notification = {
                            id: change.doc.id,
                            ...change.doc.data()
                        };
                        this.addNotification(notification);
                    }
                });
            });
            
            console.log('ðŸ”¥ Listeners de Firebase configurados');
        } catch (error) {
            console.error('âŒ Error configurando listeners:', error);
        }
    }

    // Configurar notificaciones simuladas (modo offline)
    setupSimulatedNotifications() {
        console.log('ðŸ”„ Configurando notificaciones simuladas...');
        
        // Simular notificaciones cada 2 minutos
        setInterval(() => {
            this.generateSimulatedNotification();
        }, 120000);
    }

    // Generar notificaciÃ³n simulada
    generateSimulatedNotification() {
        const clubNotifications = [
            {
                title: 'ðŸ† PrÃ³ximo Partido',
                message: 'Partido contra el CD Villarino el prÃ³ximo domingo a las 12:00',
                type: 'info',
                priority: 'medium',
                category: 'matches',
                targetRoles: ['member', 'player', 'coach', 'admin']
            },
            {
                title: 'âš½ Entrenamiento Cancelado',
                message: 'El entrenamiento de hoy se ha cancelado por mal tiempo',
                type: 'warning',
                priority: 'high',
                category: 'training',
                targetRoles: ['player', 'coach']
            },
            {
                title: 'ðŸŽ‰ Nueva IncorporaciÃ³n',
                message: 'Damos la bienvenida a nuestro nuevo jugador Juan PÃ©rez',
                type: 'success',
                priority: 'low',
                category: 'news',
                targetRoles: ['member', 'player', 'coach', 'admin', 'friend']
            },
            {
                title: 'ðŸ“‹ ReuniÃ³n de Junta',
                message: 'ReuniÃ³n de junta directiva el viernes a las 19:00',
                type: 'info',
                priority: 'medium',
                category: 'meetings',
                targetRoles: ['admin', 'coach']
            },
            {
                title: 'ðŸ’° Cuota Mensual',
                message: 'Recordatorio: La cuota mensual vence el dÃ­a 15',
                type: 'warning',
                priority: 'medium',
                category: 'payments',
                targetRoles: ['member']
            }
        ];

        // Seleccionar notificaciÃ³n aleatoria
        const randomNotification = clubNotifications[Math.floor(Math.random() * clubNotifications.length)];
        
        // Verificar si el usuario actual debe recibir esta notificaciÃ³n
        if (randomNotification.targetRoles.includes(this.userRole)) {
            // Solo mostrar ocasionalmente para no ser molesto
            if (Math.random() < 0.2) {
                this.addNotification(randomNotification);
            }
        }
    }

    // Notificación de bienvenida solo si ya hay permiso (sin pedirlo de nuevo aquí; evita doble prompt)
    setupPushNotifications() {
        if ('Notification' in window && Notification.permission === 'granted') {
            this.showWelcomeNotification();
        }
    }

    // Mostrar notificaciÃ³n de bienvenida
    showWelcomeNotification() {
        if (this.currentUser) {
            const welcomeNotification = {
                title: 'ðŸ† Bienvenido al CD Sanabria CF',
                message: `Â¡Hola ${this.currentUser.name}! Ahora recibirÃ¡s notificaciones del club.`,
                type: 'success',
                priority: 'low'
            };
            
            this.showPushNotification(welcomeNotification);
        }
    }

    // Configurar notificaciones por email
    setupEmailNotifications() {
        console.log('ðŸ“§ Sistema de notificaciones por email configurado');
        // Implementar integraciÃ³n con servicio de email
    }

    // Configurar listeners en tiempo real
    setupRealTimeListeners() {
        // Escuchar cambios en el estado del usuario
        window.addEventListener('storage', (e) => {
            if (e.key === 'currentUser') {
                this.loadCurrentUser();
            }
        });
    }

    // Manejar mensaje de Firebase
    handleFirebaseMessage(payload) {
        const notification = {
            id: payload.messageId || Date.now(),
            title: payload.notification?.title || 'CD Sanabria CF',
            message: payload.notification?.body || 'Nueva notificaciÃ³n del club',
            type: payload.data?.type || 'info',
            priority: payload.data?.priority || 'medium',
            category: payload.data?.category || 'general',
            timestamp: new Date().toISOString(),
            fromFirebase: true
        };
        
        this.addNotification(notification);
    }

    // Agregar notificaciÃ³n
    addNotification(notification) {
        // Asegurar que tenga todos los campos necesarios
        const completeNotification = {
            id: notification.id || Date.now(),
            title: notification.title || 'NotificaciÃ³n del Club',
            message: notification.message || '',
            type: notification.type || 'info',
            priority: notification.priority || 'medium',
            category: notification.category || 'general',
            timestamp: notification.timestamp || new Date().toISOString(),
            read: false,
            targetRoles: notification.targetRoles || ['member'],
            ...notification
        };
        
        this.notifications.unshift(completeNotification);
        
        // Guardar en persistencia local
        this.saveNotificationLocally(completeNotification);
        
        // Notificar suscriptores
        this.notifySubscribers(completeNotification);
        
        // Mostrar notificaciÃ³n push
        this.showPushNotification(completeNotification);
        
        // Actualizar UI
        this.updateUI();
        
        console.log('ðŸ”” Nueva notificaciÃ³n del club:', completeNotification.title);
    }

    // Guardar notificaciÃ³n localmente
    saveNotificationLocally(notification) {
        try {
            const savedNotifications = JSON.parse(localStorage.getItem('club_notifications') || '[]');
            savedNotifications.unshift(notification);
            
            // Mantener solo las Ãºltimas 100 notificaciones
            const limitedNotifications = savedNotifications.slice(0, 100);
            
            localStorage.setItem('club_notifications', JSON.stringify(limitedNotifications));
        } catch (error) {
            console.error('âŒ Error guardando notificaciÃ³n:', error);
        }
    }

    // Notificar suscriptores
    notifySubscribers(notification) {
        this.subscribers.forEach(callback => {
            try {
            callback(notification);
            } catch (error) {
                console.error('âŒ Error notificando suscriptor:', error);
            }
        });
    }

    // Mostrar notificaciÃ³n push
    showPushNotification(notification) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const pushNotification = new Notification(notification.title, {
                body: notification.message,
                icon: '/assets/escudo-cdsanabriacf.png',
                badge: '/assets/escudo-cdsanabriacf.png',
                tag: 'cd-sanabria-cf',
                requireInteraction: notification.priority === 'high',
                vibrate: notification.priority === 'high' ? [200, 100, 200] : undefined,
                data: {
                    notificationId: notification.id,
                    category: notification.category
                }
            });

            pushNotification.onclick = () => {
                window.focus();
                pushNotification.close();
                
                // Marcar como leÃ­da
                this.markAsRead(notification.id);
                
                // Abrir secciÃ³n relevante si estÃ¡ disponible
                this.handleNotificationClick(notification);
            };
            
            // Auto-cerrar despuÃ©s de 5 segundos para notificaciones de baja prioridad
            if (notification.priority === 'low') {
                setTimeout(() => {
                    pushNotification.close();
                }, 5000);
            }
        }
    }

    // Manejar click en notificaciÃ³n
    handleNotificationClick(notification) {
        // Navegar a secciÃ³n relevante segÃºn la categorÃ­a
        switch (notification.category) {
            case 'matches':
                // Abrir secciÃ³n de partidos
                window.location.hash = '#partidos';
                break;
            case 'training':
                // Abrir secciÃ³n de entrenamientos
                window.location.hash = '#entrenamientos';
                break;
            case 'news':
                // Abrir secciÃ³n de noticias
                window.location.hash = '#noticias';
                break;
            case 'meetings':
                // Abrir secciÃ³n de reuniones (solo para admin/coach)
                if (['admin', 'coach'].includes(this.userRole)) {
                    window.location.hash = '#reuniones';
                }
                break;
            case 'payments':
                // Abrir secciÃ³n de pagos (solo para miembros)
                if (this.userRole === 'member') {
                    window.location.hash = '#pagos';
                }
                break;
            default:
                // Abrir pÃ¡gina principal
                window.location.hash = '#';
        }
    }

    // Actualizar UI
    updateUI() {
        const notificationsList = document.getElementById('notificationsList');
        if (!notificationsList) return;

        notificationsList.innerHTML = '';

        if (this.notifications.length === 0) {
            notificationsList.innerHTML = '<p class="club-notif-empty">No tienes notificaciones</p>';
            this.updateNotificationCounter();
            return;
        }

        // Mostrar las últimas 10 notificaciones
        this.notifications.slice(0, 10).forEach(notification => {
            const notificationDiv = document.createElement('div');
            notificationDiv.className = `notification-item ${notification.read ? 'read' : 'unread'} ${notification.priority}`;

            const typeIcon = this.getTypeIcon(notification.type);
            const categoryIcon = this.getCategoryIcon(notification.category);
            const timeAgo = this.getTimeAgo(notification.timestamp);
            const priorityBadge = notification.priority === 'high' ? '<span class="priority-badge">URGENTE</span>' : '';

            notificationDiv.innerHTML = `
                <div class="notification-header">
                    <div class="notification-icon">${typeIcon} ${categoryIcon}</div>
                    <div class="notification-title">
                        <h3>${notification.title}</h3>
                        ${priorityBadge}
                    </div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
                <div class="notification-body">
                <p>${notification.message}</p>
                    <div class="notification-actions">
                        <button class="mark-read-btn" onclick="clubNotificationSystem.markAsRead('${notification.id}')">
                            ${notification.read ? 'âœ… LeÃ­da' : 'ðŸ“– Marcar como leÃ­da'}
                        </button>
                        ${this.canDeleteNotification() ? `<button class="delete-btn" onclick="clubNotificationSystem.deleteNotification('${notification.id}')">ðŸ—‘ï¸</button>` : ''}
                    </div>
                </div>
            `;

            notificationsList.appendChild(notificationDiv);
        });
        
        // Actualizar contador de notificaciones no leÃ­das
        this.updateNotificationCounter();
    }

    // Actualizar contador de notificaciones
    updateNotificationCounter() {
        const counter = document.getElementById('notificationCounter');
        const btn = document.getElementById('notificationBellBtn');
        const unreadCount = this.notifications.filter(n => !n.read).length;
        if (counter) {
            counter.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            counter.hidden = unreadCount === 0;
            counter.setAttribute('aria-hidden', unreadCount === 0 ? 'true' : 'false');
        }
        if (btn) {
            btn.setAttribute(
                'aria-label',
                unreadCount > 0 ? `Notificaciones (${unreadCount} sin leer)` : 'Notificaciones'
            );
        }
    }

    // Obtener icono segÃºn tipo
    getTypeIcon(type) {
        const icons = {
            'info': 'â„¹ï¸',
            'warning': 'âš ï¸',
            'success': 'âœ…',
            'error': 'âŒ',
            'emergency': 'ðŸš¨'
        };
        return icons[type] || 'ðŸ“¢';
    }

    // Obtener icono segÃºn categorÃ­a
    getCategoryIcon(category) {
        const icons = {
            'matches': 'âš½',
            'training': 'ðŸƒâ€â™‚ï¸',
            'news': 'ðŸ“°',
            'meetings': 'ðŸ¤',
            'payments': 'ðŸ’³',
            'emergency': 'ðŸš¨',
            'general': 'ðŸ†'
        };
        return icons[category] || 'ðŸ†';
    }

    // Obtener tiempo transcurrido
    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = now - time;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Ahora mismo';
        if (minutes < 60) return `Hace ${minutes} min`;
        if (hours < 24) return `Hace ${hours} h`;
        return `Hace ${days} dÃ­as`;
    }

    // Suscribirse a notificaciones
    subscribe(callback) {
        this.subscribers.push(callback);
    }

    // Obtener notificaciones
    getNotifications() {
        return this.notifications;
    }

    // Obtener notificaciones no leÃ­das
    getUnreadNotifications() {
        return this.notifications.filter(n => !n.read);
    }

    // Marcar como leÃ­da
    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id == notificationId);
        if (notification) {
            notification.read = true;
            
            // Guardar cambio localmente
            this.saveNotificationLocally(notification);
            
            // Actualizar en Firebase si estÃ¡ disponible
            if (this.firebaseInitialized) {
                this.updateNotificationInFirebase(notification);
            }
            
            this.updateUI();
            console.log('âœ… NotificaciÃ³n marcada como leÃ­da:', notification.title);
        }
    }

    // Actualizar notificaciÃ³n en Firebase
    async updateNotificationInFirebase(notification) {
        try {
            if (window.updateDocument) {
                await window.updateDocument('notifications', notification.id, {
                    read: true,
                    readAt: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('âŒ Error actualizando notificaciÃ³n en Firebase:', error);
        }
    }

    // Eliminar notificaciÃ³n
    deleteNotification(notificationId) {
        if (!this.canDeleteNotification()) {
            console.error('âŒ No tienes permisos para eliminar notificaciones');
            return false;
        }

        const notificationIndex = this.notifications.findIndex(n => n.id == notificationId);
        if (notificationIndex !== -1) {
            const notification = this.notifications[notificationIndex];
            this.notifications.splice(notificationIndex, 1);
            
            // Actualizar persistencia local
            this.saveAllNotificationsLocally();
            
            // Eliminar de Firebase si estÃ¡ disponible
            if (this.firebaseInitialized) {
                this.deleteNotificationFromFirebase(notificationId);
            }
            
            this.updateUI();
            console.log('ðŸ—‘ï¸ NotificaciÃ³n eliminada:', notification.title);
            return true;
        }
        return false;
    }

    // Eliminar notificaciÃ³n de Firebase
    async deleteNotificationFromFirebase(notificationId) {
        try {
            if (window.deleteDocument) {
                await window.deleteDocument('notifications', notificationId, this.userRole);
            }
        } catch (error) {
            console.error('âŒ Error eliminando notificaciÃ³n de Firebase:', error);
        }
    }

    // Guardar todas las notificaciones localmente
    saveAllNotificationsLocally() {
        try {
            localStorage.setItem('club_notifications', JSON.stringify(this.notifications));
        } catch (error) {
            console.error('âŒ Error guardando notificaciones:', error);
        }
    }

    // Verificar si puede eliminar notificaciones
    canDeleteNotification() {
        return ['admin', 'coach'].includes(this.userRole);
    }

    // Enviar notificaciÃ³n (solo admin/coach)
    async sendNotification(notificationData) {
        if (!this.canSendNotifications()) {
            console.error('âŒ Solo administradores y entrenadores pueden enviar notificaciones');
            return false;
        }

        const notification = {
            id: Date.now(),
            ...notificationData,
            timestamp: new Date().toISOString(),
            sentBy: this.currentUser.email,
            sentByRole: this.userRole
        };

        try {
            // Guardar en Firebase si estÃ¡ disponible
            if (this.firebaseInitialized) {
                await this.saveNotificationToFirebase(notification);
            } else {
                // Agregar localmente
                this.addNotification(notification);
            }
            
            console.log('âœ… NotificaciÃ³n enviada:', notification.title);
            return true;
        } catch (error) {
            console.error('âŒ Error enviando notificaciÃ³n:', error);
            return false;
        }
    }

    // Guardar notificaciÃ³n en Firebase
    async saveNotificationToFirebase(notification) {
        try {
            if (window.createDocument) {
                const docId = await window.createDocument('notifications', notification);
                notification.id = docId;
            }
        } catch (error) {
            console.error('âŒ Error guardando en Firebase:', error);
            throw error;
        }
    }

    // Verificar si puede enviar notificaciones
    canSendNotifications() {
        return ['admin', 'coach'].includes(this.userRole);
    }

    // Configurar usuario actual
    setCurrentUser(user) {
        this.currentUser = user;
        this.userRole = user?.role || 'guest';
        console.log('ðŸ‘¤ Usuario configurado:', user?.email, 'Rol:', this.userRole);
        
        // Recargar notificaciones para el nuevo usuario
        this.loadNotificationsForUser();
    }

    // Cargar notificaciones para el usuario actual
    loadNotificationsForUser() {
        try {
            // Cargar notificaciones guardadas localmente
            const savedNotifications = JSON.parse(localStorage.getItem('club_notifications') || '[]');
            
            // Filtrar notificaciones que el usuario actual debe ver
            this.notifications = savedNotifications.filter(notification => {
                return notification.targetRoles.includes(this.userRole) || 
                       notification.targetRoles.includes('all');
            });
            
            this.updateUI();
            console.log('ðŸ“± Notificaciones cargadas para usuario:', this.notifications.length);
        } catch (error) {
            console.error('âŒ Error cargando notificaciones:', error);
            this.notifications = [];
        }
    }

    // Limpiar todas las notificaciones (solo admin)
    clearAllNotifications() {
        if (this.userRole !== 'admin') {
            console.error('âŒ Solo el administrador puede limpiar todas las notificaciones');
            return false;
        }

        this.notifications = [];
        localStorage.removeItem('club_notifications');
        this.updateUI();
        
        console.log('ðŸ§¹ Todas las notificaciones eliminadas');
        return true;
    }

    // Obtener estadÃ­sticas de notificaciones
    getNotificationStats() {
        const total = this.notifications.length;
        const unread = this.notifications.filter(n => !n.read).length;
        const byCategory = {};
        const byPriority = {};

        this.notifications.forEach(notification => {
            // Contar por categorÃ­a
            byCategory[notification.category] = (byCategory[notification.category] || 0) + 1;
            
            // Contar por prioridad
            byPriority[notification.priority] = (byPriority[notification.priority] || 0) + 1;
        });

        return {
            total,
            unread,
            read: total - unread,
            byCategory,
            byPriority,
            userRole: this.userRole,
            canSend: this.canSendNotifications(),
            canDelete: this.canDeleteNotification()
        };
    }
}

// Crear instancia global
const clubNotificationSystem = new ClubNotificationSystem();

// Exportar para uso global
window.clubNotificationSystem = clubNotificationSystem;
window.notificationSystem = clubNotificationSystem; // Compatibilidad con cÃ³digo existente

console.log('ðŸ”” Sistema de notificaciones CD Sanabria CF cargado - ComunicaciÃ³n entre roles activada');


