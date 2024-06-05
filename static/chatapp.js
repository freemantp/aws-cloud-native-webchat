const { createApp, onMounted, onUnmounted, ref } = Vue;

/// INSERT YOUR WEBSOCKET URL HERE
const WEBSOCKET_URL = "wss://your-api.eu-central-1.amazonaws.com/production/"
const TRANSLATION_ENABLED = false
// DO NOT EDIT BEYOND THIS LINE

createApp({
    setup() {
        const username = ref("");
        const isUsernameSet = ref(false);
        const connected = ref(false);
        const messages = ref([]);
        const outgoingMessage = ref("");
        const ws = ref(undefined);
        const notificationsEnabled = ref(false);
        const translationEnabled = ref(TRANSLATION_ENABLED)
        const translationLanguage = ref(undefined);
        let intervalId;

        const availableLanguages = ref([
            { text: 'Deutsch', value: 'de' },
            { text: 'English', value: 'en' },
            { text: 'Français', value: 'fr' },
            { text: 'Italiano', value: 'it' },
            { text: 'Русский', value: 'ru' }
        ]);

        (async () => {
            let permission = await Notification.requestPermission();
            notificationsEnabled.value = permission === "granted";
        })();

        onMounted(() => {
            if (localStorage) {
                username.value = localStorage.getItem("userName");
            }

            intervalId = setInterval(() => heartbeat(), 200000);

            M.AutoInit();
        });

        // Set up periodic heartbeats to keep the websocket alive
        onUnmounted(() => stopHeartbeat());

        const heartbeat = () => {
            if (ws.value) {
                ws.value.send(
                    JSON.stringify({
                        action: "heartbeat",
                    })
                );
            }
        };

        const stopHeartbeat = () => {
            clearInterval(intervalId);
        };

        const connect = () => {
            ws.value = new WebSocket(WEBSOCKET_URL);

            ws.value.onopen = () => {
                connected.value = true;

                // Re-set name on reconnect
                if (username.value) {
                    updateUserHandleRemote(username.value, translationLanguage.value);
                }

                //Request recent messages, will be processed in onMessage
                ws.value.send(JSON.stringify({ action: "getmessages" }));
            };

            ws.value.onclose = (e) => {
                console.log(
                    "Socket is closed, reason: '" +
                    e.reason +
                    ". Reconnect will be attempted in 1 second."
                );
                connected.value = false;

                stopHeartbeat();

                setTimeout(function () {
                    connect();
                }, 1000);
            };

            ws.value.onmessage = (event) => {
                if (event.data) {
                    try {
                        const payload = JSON.parse(event.data);

                        if (Object.hasOwn(payload, "messages")) {
                            messages.value = payload.messages.map((item) => {
                                return {
                                    sender: item.userHandle,
                                    content: item.message,
                                    isOwnMessage: username.value === item.userHandle,
                                };
                            });
                            messages.value.reverse();
                        } else {
                            var senderHandle = payload.userHandle || "Anonymous";
                            messages.value.unshift({
                                sender: senderHandle,
                                content: payload.message,
                                isOwnMessage: false,
                            });
                            var sound = document.getElementById("newMessageSound");
                            sound.play();

                            if (notificationsEnabled && !document.hasFocus()) {
                                const greeting = new Notification(senderHandle, {
                                    body: payload.message,
                                });
                            }
                        }
                    } catch (err) { }
                }
            };
            ws.value.onerror = (error) => {
                console.error("WebSocket error:", error);
            };
        };

        const sendMessage = () => {
            if (outgoingMessage.value.trim() === "") return;

            ws.value.send(
                JSON.stringify({
                    action: "sendmessage",
                    message: outgoingMessage.value,
                })
            );

            const msg = {
                sender: username,
                content: outgoingMessage.value,
                isOwnMessage: true,
            };

            messages.value.unshift(msg);

            outgoingMessage.value = "";
        };

        const updateUserHandleRemote = (userName, translationLang) => {
            const mesage_body = {
                action: "setname",
                name: userName,
            };

            if (translationLang) {
                mesage_body['transationLang'] = translationLang
            }

            ws.value.send(JSON.stringify(mesage_body));
        };

        const updateTranslationLanguage = (lang) => {
            const mesage_body = {
                action: "settranslationlang",
                name: lang,
            };

            ws.value.send(JSON.stringify(mesage_body));
        };


        const updateUsernameAndConnect = () => {
            if (username.value.trim() === "") return;

            if (localStorage) {
                localStorage.setItem("userName", username.value);
            }
            isUsernameSet.value = true;

            connect();
        };

        const getUserProfilePictureUrl = (username) => {
            username_hex = Array.from(username)
                .map((char) => char.charCodeAt(0).toString(16))
                .join("");
            return (
                "https://www.gravatar.com/avatar/" +
                username_hex.padStart(64 - username_hex.length, "a") +
                "?d=robohash&f=y"
            );
        };

        return {
            ws,
            connected,
            messages,
            outgoingMessage,
            username,
            isUsernameSet,
            translationLanguage,
            options: availableLanguages,
            sendMessage,
            updateUserHandleRemote,
            updateUsernameAndConnect,
            updateTranslationLanguage,
            translationEnabled,
            getUserProfilePictureUrl,
            heartbeat,
        };
    },
}).mount("#app");
