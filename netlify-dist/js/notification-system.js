/**
 * ðŸ”” SISTEMA DE NOTIFICACIONES EN TIEMPO REAL - CDSANABRIACF
 * ComunicaciÃ³n entre entrenadores, equipo, administradores, socios y amigos del club
 * Integrado con la nube para sincronizaciÃ³n en tiempo real
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
        this._notificationsListenerActive = false;
        
        this.init();
    }

    async init() {
        await this.loadCurrentUser();
        await this.setupFirebaseIntegration();
        this.setupPushNotifications();
        this.setupEmailNotifications();
        this.setupRealTimeListeners();
        this.setupServiceWorkerPushBridge();
        this.loadNotificationsForUser();
        console.log('Sistema de notificaciones CD Sanabria CF inicializado');
    }

    async getServiceWorkerRegistration() {
        if (!('serviceWorker' in navigator)) return null;
        try {
            return await navigator.serviceWorker.ready;
        } catch (_) {
            return null;
        }
    }

    userWantsPushNotifications() {
        try {
            const prefs = JSON.parse(localStorage.getItem('notificationPreferences') || '{}');
            const socio = JSON.parse(localStorage.getItem('currentSocio') || 'null');
            const amigo = JSON.parse(localStorage.getItem('currentAmigo') || 'null');
            const coach = JSON.parse(localStorage.getItem('currentCoach') || 'null');
            const email = String(
                (socio && socio.email) ||
                    (amigo && amigo.email) ||
                    (coach && coach.email) ||
                    ''
            )
                .trim()
                .toLowerCase();
            if (email && prefs[email] && prefs[email].enabled === true) return true;
            if (socio && socio.notificaciones === true) return true;
            if (amigo && amigo.notificaciones === true) return true;
            if (coach && coach.receiveNotifications === true) return true;
            if (email) {
                const members = JSON.parse(localStorage.getItem('clubMembers') || '[]');
                const member = members.find(function (m) {
                    return String(m.email || '')
                        .trim()
                        .toLowerCase() === email;
                });
                if (member && member.notificaciones === true) return true;
                const friends = JSON.parse(localStorage.getItem('clubFriends') || '[]');
                const friend = friends.find(function (f) {
                    return String(f.email || '')
                        .trim()
                        .toLowerCase() === email;
                });
                if (friend && friend.notificaciones === true) return true;
            }
        } catch (_) {}
        return false;
    }

    shouldShowNotificationPrompt() {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') return false;
        if (Notification.permission === 'denied') {
            return this.userWantsPushNotifications() && !sessionStorage.getItem('cdsan_notify_denied_help_shown');
        }
        if (this.userWantsPushNotifications()) return true;
        const hidden = localStorage.getItem('cdsanabria_notify_prompt_hidden');
        if (hidden && Date.now() - Number(hidden) < 7 * 24 * 60 * 60 * 1000) return false;
        return true;
    }

    markNotificationPromptDismissed() {
        localStorage.setItem('cdsanabria_notify_prompt_hidden', String(Date.now()));
    }

    async promptNotificationsOnAppOpen() {
        if (Notification.permission === 'granted') {
            if (this.userWantsPushNotifications() || this.resolveAuthUid()) {
                this._fcmSetupComplete = false;
                await this.setupCloudMessagingSilent();
            }
            return;
        }
        if (!this.shouldShowNotificationPrompt()) return;
        if (typeof window.mostrarAvisoNotificacionesClub === 'function') {
            window.mostrarAvisoNotificacionesClub();
        }
    }

    async activatePushFromUserConsent() {
        const email =
            (this.currentUser && this.currentUser.email) ||
            JSON.parse(localStorage.getItem('currentSocio') || 'null')?.email ||
            JSON.parse(localStorage.getItem('currentAmigo') || 'null')?.email ||
            '';
        if (email) {
            const prefs = JSON.parse(localStorage.getItem('notificationPreferences') || '{}');
            prefs[String(email).trim().toLowerCase()] = {
                enabled: true,
                fechaActivacion: new Date().toISOString()
            };
            localStorage.setItem('notificationPreferences', JSON.stringify(prefs));
        }
        return this.registerPushAfterLogin();
    }

    resolveAuthUid() {
        try {
            const auth = window.firebaseAuth;
            if (auth && auth.currentUser && auth.currentUser.uid) return auth.currentUser.uid;
            const socio = JSON.parse(localStorage.getItem('currentSocio') || 'null');
            if (socio && socio.authUid) return socio.authUid;
            const amigo = JSON.parse(localStorage.getItem('currentAmigo') || 'null');
            if (amigo && amigo.authUid) return amigo.authUid;
            const coach = JSON.parse(localStorage.getItem('currentCoach') || 'null');
            if (coach && coach.authUid) return coach.authUid;
            const member = JSON.parse(localStorage.getItem('currentMember') || 'null');
            if (member && member.authUid) return member.authUid;
        } catch (_) {}
        return null;
    }

    /** Espera a que la nube restaure la sesión (necesario para guardar token FCM en Firestore). */
    async waitForFirebaseAuth(maxMs) {
        const limit = typeof maxMs === 'number' ? maxMs : 10000;
        if (!window.firebaseAuth || window.firebaseAuth.isSimulation) return null;
        const auth = window.firebaseAuth;
        if (auth.currentUser && auth.currentUser.uid) return auth.currentUser.uid;

        const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js');
        return new Promise(function (resolve) {
            let finished = false;
            let unsub = function () {};
            const finish = function (uid) {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                try {
                    unsub();
                } catch (_) {}
                resolve(uid || null);
            };
            const timer = setTimeout(function () {
                finish(null);
            }, limit);
            unsub = onAuthStateChanged(auth, function (user) {
                if (user && user.uid) finish(user.uid);
            });
        });
    }

    resolveSessionEmail() {
        if (this.currentUser && this.currentUser.email) {
            return String(this.currentUser.email).trim().toLowerCase();
        }
        try {
            const socio = JSON.parse(localStorage.getItem('currentSocio') || 'null');
            if (socio && socio.email) return String(socio.email).trim().toLowerCase();
            const amigo = JSON.parse(localStorage.getItem('currentAmigo') || 'null');
            if (amigo && amigo.email) return String(amigo.email).trim().toLowerCase();
            const coach = JSON.parse(localStorage.getItem('currentCoach') || 'null');
            if (coach && coach.email) return String(coach.email).trim().toLowerCase();
        } catch (_) {}
        return '';
    }

    resolveUserRoles() {
        const roles = new Set();
        const base = String(this.userRole || 'guest').toLowerCase();
        if (base) roles.add(base);
        if (this.currentUser && Array.isArray(this.currentUser.roles)) {
            this.currentUser.roles.forEach(function (r) {
                if (r) roles.add(String(r).toLowerCase());
            });
        }
        try {
            const socio = JSON.parse(localStorage.getItem('currentSocio') || 'null');
            if (socio && socio.isJugador) roles.add('player');
            if (socio && socio.isEntrenador) roles.add('coach');
        } catch (_) {}
        if (roles.has('coach')) roles.add('coach');
        return [...roles];
    }

    setupServiceWorkerPushBridge() {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.addEventListener('message', (event) => {
            const data = event.data || {};
            if (data.type !== 'CLUB_PUSH_RECEIVED') return;
            const payload = data.payload || {};
            const notification = {
                id: payload.notifId || payload.tag || Date.now(),
                broadcastId: payload.notifId || payload.tag,
                title: payload.title || 'CD Sanabria CF',
                message: payload.body || '',
                type: payload.urgent === '1' || payload.urgent === true ? 'urgent' : 'general',
                priority: payload.urgent === '1' || payload.urgent === true ? 'high' : 'medium',
                category: 'announcement',
                timestamp: new Date().toISOString(),
                read: false,
                targetRoles: ['all'],
                fromFirebase: true
            };
            this.mergeNotificationIfNew(notification, { silent: false, push: false });
        });
    }

    updateAppBadge(unreadCount) {
        try {
            if (typeof navigator.setAppBadge === 'function') {
                if (unreadCount > 0) navigator.setAppBadge(unreadCount > 99 ? 99 : unreadCount);
                else if (typeof navigator.clearAppBadge === 'function') navigator.clearAppBadge();
            }
        } catch (_) {}
        const btn = document.getElementById('notificationBellBtn');
        if (btn) {
            if (unreadCount > 0) btn.classList.add('has-unread');
            else btn.classList.remove('has-unread');
        }
    }

    /** Solo obtiene token si ya hay permiso (sin diálogo). */
    async setupCloudMessagingSilent() {
        try {
            if (this._fcmSetupComplete) return;
            if (!window.firebaseMessaging || window.firebaseMessaging.isSimulation) return;
            if (!('Notification' in window) || Notification.permission !== 'granted') return;

            const { getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging.js');
            const swReg = await this.getServiceWorkerRegistration();
            const tokenOpts = {
                vapidKey: 'BK6QOHZGAPCgqsDEtjGfIST2F5G0t6ICn7Gn-nZksTEwqxd6A8w9yb7YNlHqQimbhqmrRWigHTy1DIAXfbN0LFQ'
            };
            if (swReg) tokenOpts.serviceWorkerRegistration = swReg;

            const token = await getToken(window.firebaseMessaging, tokenOpts);
            if (!token) return;

            this.fcmToken = token;
            console.log('🔔 Token FCM registrado para push del club');
            await this.saveUserToken(token);

            if (!this._fcmForegroundListenerAttached) {
                onMessage(window.firebaseMessaging, (payload) => {
                    this.handleFirebaseMessage(payload);
                });
                this._fcmForegroundListenerAttached = true;
            }
            this._fcmSetupComplete = true;
        } catch (error) {
            console.error('Error registrando token FCM:', error);
        }
    }

    async refreshFcmTokenIfPermitted() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        this._fcmSetupComplete = false;
        await this.setupCloudMessagingSilent();
    }

    /** Tras login (gesto del usuario): pedir permiso y registrar dispositivo. */
    async registerPushAfterLogin() {
        if (!('Notification' in window)) return 'unsupported';
        if (Notification.permission === 'denied') return 'denied';
        if (Notification.permission === 'default') {
            return this.solicitarPermisoNotificacionesNavegador();
        }
        this._fcmSetupComplete = false;
        await this.setupCloudMessagingSilent();
        return 'granted';
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

    // Configurar integraciÃ³n con la nube
    async setupFirebaseIntegration() {
        try {
            // Verificar si la nube estÃ¡ disponible
            if (window.firebaseDb && !window.firebaseDb.isSimulation) {
                this.firebaseInitialized = true;
                console.log('ðŸ”¥ la nube configurado para notificaciones');
                
                // Configurar Cloud Messaging (solo si ya hay permiso; el diálogo va tras login o botón PWA)
                await this.setupCloudMessagingSilent();
                await this.setupAuthTokenRefresh();
                
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

    async setupAuthTokenRefresh() {
        try {
            if (!window.firebaseAuth || window.firebaseAuth.isSimulation) return;
            const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js');
            onAuthStateChanged(window.firebaseAuth, (user) => {
                if (user && Notification.permission === 'granted') {
                    this._fcmSetupComplete = false;
                    this.setupCloudMessagingSilent().catch(() => {});
                }
            });
        } catch (_) {}
    }

    // Configurar Cloud Messaging (con diálogo de permiso — solo desde botón o login)
    async setupCloudMessaging() {
        try {
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

            this._fcmSetupComplete = false;
            await this.setupCloudMessagingSilent();
        } catch (error) {
            console.error('Error configurando Cloud Messaging:', error);
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

    async saveUserToken(token) {
        try {
            if (!token || !window.firebaseDb || window.firebaseDb.isSimulation) return;

            const uid = await this.waitForFirebaseAuth();
            if (!uid) {
                console.warn(
                    'Token FCM no guardado: abre la PWA e inicia sesión (socio/amigo) para recibir avisos con la app cerrada'
                );
                return;
            }

            const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');
            const collectionName = window.DB_COLLECTIONS?.FCM_TOKENS || 'sanabria_fcm_tokens';
            const userRoles = this.resolveUserRoles();
            const wantsPush = this.userWantsPushNotifications();

            await setDoc(
                doc(window.firebaseDb, collectionName, uid),
                {
                    appScope: window.APP_SCOPE || 'cdsanabriacf',
                    fcmToken: token,
                    userRole: userRoles[0] || this.userRole || 'guest',
                    userRoles: userRoles,
                    wantsPush: wantsPush !== false,
                    email: this.resolveSessionEmail(),
                    teams: this.getUserTeams(),
                    authUid: uid,
                    lastTokenUpdate: new Date().toISOString(),
                    updatedAt: serverTimestamp()
                },
                { merge: true }
            );

            console.log('Token FCM guardado en la nube para push del club');
        } catch (error) {
            console.error('Error guardando token FCM (¿sesión activa?):', error);
        }
    }

    getUserTeams() {
        const teams = [];
        try {
            const socio = JSON.parse(localStorage.getItem('currentSocio') || 'null');
            const coach = JSON.parse(localStorage.getItem('currentCoach') || 'null');
            if (socio && socio.playerCategory) teams.push(String(socio.playerCategory).toLowerCase());
            if (coach && coach.team) teams.push(String(coach.team).toLowerCase());
            if (coach && coach.category) teams.push(String(coach.category).toLowerCase());
        } catch (_) {}
        return [...new Set(teams.filter(Boolean))];
    }

    notificationDedupeKey(notification) {
        if (!notification) return '';
        return String(
            notification.broadcastId ||
            notification.clientMessageId ||
            (notification.sentAt && notification.title ? notification.sentAt + '|' + notification.title : '') ||
            notification.id ||
            ''
        );
    }

    // Configurar listeners de la nube en tiempo real
    async setupFirebaseListeners() {
        if (!this.firebaseInitialized) return;

        try {
            const { collection, query, where, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');
            const notificationsCollection = window.DB_COLLECTIONS?.NOTIFICATIONS || 'sanabria_notifications';
            const appScope = (window.APP_SCOPE || 'cdsanabriacf');
            const q = query(
                collection(window.firebaseDb, notificationsCollection),
                where('appScope', '==', appScope)
            );

            onSnapshot(q, (snapshot) => {
                const isInitial = !this._notificationsListenerActive;
                this._notificationsListenerActive = true;

                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'removed') return;
                    const normalized = this.normalizeRemoteNotification({
                        id: change.doc.id,
                        ...change.doc.data()
                    });
                    if (!normalized || !this.userShouldSeeNotification(normalized)) return;

                    const showDevicePush = change.type === 'added' && !isInitial;
                    this.mergeNotificationIfNew(normalized, {
                        silent: isInitial,
                        push: showDevicePush
                    });
                });
            });

            console.log('🔥 Listeners de avisos del club configurados');
        } catch (error) {
            console.error('❌ Error configurando listeners:', error);
        }
    }

    normalizeRemoteNotification(doc) {
        if (!doc || typeof doc !== 'object') return null;
        if (doc.senderType !== 'admin' && doc.broadcast !== true) return null;

        const timestamp =
            doc.timestamp ||
            doc.sentAt ||
            (doc.createdAt && doc.createdAt.toDate ? doc.createdAt.toDate().toISOString() : doc.createdAt) ||
            new Date().toISOString();

        const canonicalId = String(doc.broadcastId || doc.clientMessageId || doc.id || '');

        return {
            id: canonicalId,
            firebaseDocId: doc.id,
            broadcastId: doc.broadcastId || doc.clientMessageId || canonicalId,
            title: doc.title || 'Aviso del club',
            message: doc.message || doc.content || '',
            type: doc.type || 'info',
            priority: doc.priority || (doc.type === 'urgent' ? 'high' : 'medium'),
            category: doc.category || 'announcement',
            timestamp: timestamp,
            read: doc.read === true,
            targetRoles: Array.isArray(doc.targetRoles) && doc.targetRoles.length
                ? doc.targetRoles
                : ['all'],
            targetTeams: Array.isArray(doc.targetTeams) ? doc.targetTeams : [],
            attachmentUrl: doc.attachmentUrl || null,
            attachmentType: doc.attachmentType || null,
            attachmentName: doc.attachmentName || null,
            imageUrl: doc.attachmentUrl || doc.imageUrl || null,
            fromFirebase: true
        };
    }

    userShouldSeeNotification(notification) {
        if (!notification || !Array.isArray(notification.targetRoles)) return false;

        const userRoles = this.resolveUserRoles();
        const roleOk =
            notification.targetRoles.includes('all') ||
            notification.targetRoles.some(function (r) {
                return userRoles.includes(String(r).toLowerCase());
            });
        if (!roleOk) return false;

        const teams = notification.targetTeams;
        if (!teams || !teams.length || teams.includes('all')) return true;

        const userTeams = this.getUserTeams().map((t) => t.toLowerCase());
        if (!userTeams.length) return false;

        const wanted = teams.map((t) => String(t).toLowerCase());
        return userTeams.some((t) => wanted.includes(t));
    }

    mergeNotificationIfNew(notification, options) {
        const opts = options || {};
        const dedupeKey = this.notificationDedupeKey(notification);
        const exists = this.notifications.some((n) => this.notificationDedupeKey(n) === dedupeKey);
        if (!dedupeKey || exists) return false;

        this.notifications.unshift(notification);
        this.saveNotificationLocally(notification);
        this.notifySubscribers(notification);
        if (opts.push !== false) {
            this.showPushNotification(notification);
        }
        this.updateUI();
        return true;
    }

    async syncClubAnnouncementsFromFirebase() {
        if (!window.getDocuments || typeof window.getDocuments !== 'function') return;
        try {
            const docs = await window.getDocuments('notifications');
            const incoming = (docs || [])
                .map((doc) => this.normalizeRemoteNotification(doc))
                .filter((doc) => doc && this.userShouldSeeNotification(doc));

            if (!incoming.length) {
                this.loadNotificationsForUser();
                return;
            }

            let added = 0;
            incoming.forEach((doc) => {
                if (this.mergeNotificationIfNew(doc, { silent: true, push: false })) {
                    added += 1;
                }
            });

            if (added > 0) {
                console.log('🔔 Avisos del club sincronizados:', added);
            } else {
                this.loadNotificationsForUser();
            }
        } catch (error) {
            console.warn('No se pudieron sincronizar avisos del club:', error);
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

    // Manejar mensaje de la nube
    handleFirebaseMessage(payload) {
        const data = payload.data || {};
        const notification = {
            id: data.notifId || payload.messageId || Date.now(),
            broadcastId: data.notifId || data.tag,
            title: payload.notification?.title || data.title || 'CD Sanabria CF',
            message: payload.notification?.body || data.body || 'Nueva notificación del club',
            type: data.urgent === '1' ? 'urgent' : data.type || 'info',
            priority: data.urgent === '1' ? 'high' : data.priority || 'medium',
            category: data.category || 'general',
            timestamp: new Date().toISOString(),
            read: false,
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
            const dedupeKey = this.notificationDedupeKey(notification);
            let savedNotifications = JSON.parse(localStorage.getItem('club_notifications') || '[]');
            savedNotifications = savedNotifications.filter(
                (n) => this.notificationDedupeKey(n) !== dedupeKey
            );
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
                icon: '/assets/escudo-192.png',
                badge: '/assets/escudo-192.png',
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
                this.markAsRead(notification.id);
                const openId = notification.broadcastId || notification.id;
                if (window.ClubNotificationDetail && typeof window.ClubNotificationDetail.open === 'function') {
                    window.ClubNotificationDetail.open(openId);
                } else {
                    this.handleNotificationClick(notification);
                }
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
            notificationDiv.style.cursor = 'pointer';
            const openId = notification.broadcastId || notification.id;
            notificationDiv.onclick = function (ev) {
                if (ev.target.closest('button')) return;
                if (window.ClubNotificationDetail && typeof window.ClubNotificationDetail.open === 'function') {
                    window.ClubNotificationDetail.open(openId);
                }
            };

            const typeIcon = this.getTypeIcon(notification.type);
            const categoryIcon = this.getCategoryIcon(notification.category);
            const showCategoryIcon = categoryIcon && categoryIcon !== typeIcon;
            const timeAgo = this.getTimeAgo(notification.timestamp);
            const priorityBadge = notification.priority === 'high' ? '<span class="priority-badge">URGENTE</span>' : '';

            notificationDiv.innerHTML = `
                <div class="notification-header">
                    <div class="notification-icon">${typeIcon}${showCategoryIcon ? ' ' + categoryIcon : ''}</div>
                    <div class="notification-title">
                        <h3>${notification.title}</h3>
                        ${priorityBadge}
                    </div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
                <div class="notification-body">
                <p>${notification.message}</p>
                ${notification.attachmentUrl && (String(notification.attachmentType || '').indexOf('image/') === 0 || /\.(jpg|jpeg|png|webp)(\?|$)/i.test(String(notification.attachmentUrl))) ? '<img src="' + notification.attachmentUrl + '" alt="" style="display:block;max-width:100%;margin-top:10px;border-radius:8px;">' : ''}
                ${notification.attachmentUrl && (String(notification.attachmentType || '') === 'application/pdf' || /\.pdf(\?|$)/i.test(String(notification.attachmentUrl))) ? '<p style="margin-top:8px;"><a href="' + notification.attachmentUrl + '" target="_blank" rel="noopener">📄 Ver PDF adjunto</a></p>' : ''}
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
        this.updateAppBadge(unreadCount);
    }

    // Obtener icono segÃºn tipo
    getTypeIcon(type) {
        const icons = {
            'info': 'ℹ️',
            'general': '📢',
            'warning': '⚠️',
            'reminder': '⏰',
            'success': '✅',
            'error': '❌',
            'emergency': '🚨',
            'urgent': '🚨',
            'announcement': '📣',
            'competicion': '🏆'
        };
        return icons[type] || '📢';
    }

    getCategoryIcon(category) {
        const icons = {
            'matches': '⚽',
            'training': '🏃',
            'news': '📰',
            'meetings': '🤝',
            'payments': '💳',
            'emergency': '🚨',
            'general': '📢',
            'announcement': '📣'
        };
        return icons[category] || '📣';
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
            
            // Actualizar en la nube si estÃ¡ disponible
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
            
            // Eliminar de la nube si estÃ¡ disponible
            if (this.firebaseInitialized) {
                this.deleteNotificationFromFirebase(notificationId);
            }
            
            this.updateUI();
            console.log('ðŸ—‘ï¸ NotificaciÃ³n eliminada:', notification.title);
            return true;
        }
        return false;
    }

    // Eliminar notificaciÃ³n de la nube
    async deleteNotificationFromFirebase(notificationId) {
        try {
            if (window.deleteDocument) {
                await window.deleteDocument('notifications', notificationId, this.userRole);
            }
        } catch (error) {
            console.error('âŒ Error eliminando notificaciÃ³n de la nube:', error);
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
            // Guardar en la nube si estÃ¡ disponible
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
        console.log('Usuario configurado para notificaciones:', user?.email, 'Rol:', this.userRole);

        this.loadNotificationsForUser();
        if (this.fcmToken || Notification.permission === 'granted') {
            this._fcmSetupComplete = false;
            this.setupCloudMessagingSilent().catch(() => {});
        } else if (this.fcmToken) {
            this.saveUserToken(this.fcmToken).catch(() => {});
        }
    }

    // Cargar notificaciones para el usuario actual
    loadNotificationsForUser() {
        try {
            const savedNotifications = JSON.parse(localStorage.getItem('club_notifications') || '[]');
            const seen = new Set();

            this.notifications = savedNotifications.filter((notification) => {
                if (!this.userShouldSeeNotification(notification)) return false;
                const key = this.notificationDedupeKey(notification);
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            this.updateUI();
            console.log('📱 Notificaciones cargadas para usuario:', this.notifications.length);
            const unreadCount = this.notifications.filter(function (n) {
                return !n.read;
            }).length;
            this.updateAppBadge(unreadCount);
        } catch (error) {
            console.error('❌ Error cargando notificaciones:', error);
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


