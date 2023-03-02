import wsEvent from './eventEmitter'

const connectRTC = (pc: RTCPeerConnection, onOpen: () => void, onClose: () => void) => {

    const dataChannelParams = { ordered: true, protocol: 'raw' };

    // Make a RTC data channel
    const pcDataChannel = pc.createDataChannel('sendDataChannel', dataChannelParams)

    pcDataChannel.onopen = (ev: Event) => {
        console.log("RTC Connected")
        onOpen()
    }

    pcDataChannel.onclose = (ev: Event) => {
        console.log("RTC Disconnected")
        console.log(ev)
        onClose()

        setTimeout(() => {
            window.close()
        }, 5000)
    }

    pcDataChannel.onerror = (ev) => {
        console.log("RTC Error")
        console.log(ev)
    }

    pcDataChannel.onmessage = (event) => {
        const eventdata = JSON.parse(event.data)
        const func = eventdata[0]
        const data = eventdata[1]
        wsEvent.emit('wsRx', func, data)
    }

    pcDataChannel.onclosing = (ev) => {
        console.log("RTC Closing")
        console.log(ev)
    }

    negotiateRTC(pc);

    return pcDataChannel
}

const negotiateRTC = (pc: RTCPeerConnection) => {
    return pc
        .createOffer()
        .then(function (offer) {
            return pc.setLocalDescription(offer)
        })
        .then(function () {
            // wait for ICE gathering to complete
            return new Promise<void>((resolve) => {
                if (pc.iceGatheringState === 'complete') {
                    resolve()
                } else {
                    const checkState = () => {
                        if (pc.iceGatheringState === 'complete') {
                            pc.removeEventListener(
                                'icegatheringstatechange',
                                checkState
                            )
                            resolve()
                        }
                    }
                    pc.addEventListener(
                        'icegatheringstatechange',
                        checkState
                    )
                }
            })
        })
        .then(function () {
            var offer = pc.localDescription;
            console.log(offer)
            return fetch('/offer', {
                body: JSON.stringify({
                    type: 'offer',
                    offer: {
                        sdp: offer.sdp,
                        type: offer.type,
                    },
                }),
                headers: {
                    'Content-Type': 'application/json'
                },
                method: 'POST'
            });
        })
        .then(function (response) {
            return response.json();
        })
        .then(function (answer) {
            return pc.setRemoteDescription(answer);
        })
        .catch(function (e) {
            console.log("RTC Connection Error")
            console.log(e);
        });
}

export { connectRTC }