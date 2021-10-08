import * as THREE from 'three'
THREE.Object3D.DefaultUp.set(0, 0, 1)
import React, { useState, useEffect, useReducer, useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import Capture, { ICaptureProps } from './Recorder'
import SwiftInfo from '../components/SwiftInfo'
import SwiftBar, { ISwiftBar, ISwiftElement } from '../components/SwiftBar'
import styles from '../styles/Swift.module.scss'
import formReducer, { DEFUALT_ELEMENTS } from './Swift.reducer'
import { FormDispatch } from './FormDispatch'
import wsEvent from './eventEmitter'
import {
    Plane,
    ShadowedLight,
    Camera,
    IShapeProps,
    Shape,
} from './SwiftComponents'

import Controls from './Controls'
import { send } from 'process'

interface IMeshCollection {
    meshes: IShapeProps[]
}

const MeshCollection = (props: IMeshCollection): JSX.Element => {
    return (
        <group>
            {props.meshes.map((value, i) => {
                return <Shape key={i} {...value} />
            })}
        </group>
    )
}

interface IGroupCollection {
    meshes: IShapeProps[][]
}

const GroupCollection = React.forwardRef<THREE.Group, IGroupCollection>(
    (props, ref): JSX.Element => {
        return (
            <group ref={ref}>
                {props.meshes.map((value, i) => {
                    return <MeshCollection key={i} meshes={value} />
                })}
            </group>
        )
    }
)

const SwiftState = () => { }

export interface ISwiftProps {
    port: number
}

interface CanvasElement extends HTMLCanvasElement {
    captureStream(frameRate?: number): MediaStream
}

const Swift: React.FC<ISwiftProps> = (props: ISwiftProps): JSX.Element => {
    const [hasMounted, setHasMounted] = useState(false)
    const [time, setTime] = useState(0.0)
    const shapes = useRef<THREE.Group>()
    const ws = useRef<WebSocket>(null)
    const [shapeDesc, setShapeDesc] = useState<IShapeProps[][]>([])
    const [connected, setConnected] = useState(false)
    const [rtcConnected, setRtcConnected] = useState(false)
    const [formState, formDispatch] = useReducer(formReducer, {
        formData: {},
        formElements: [],
    })
    const [cameraPosition, setCameraPosition] = useState([0.2, 1.2, 0.7])
    const [cameraLookAt, setCameraLookAt] = useState([0, 0, 0.2])
    const [captureState, setCaptureState] = useState<ICaptureProps>({
        screenshot: false,
        startRecord: false,
        stopRecord: false,
        isRecording: false,
        shouldCapture: false,
        ext: 'png',
        filename: 'swift_recording',
        snap_filename: 'swift_snap',
        format: '',
        framerate: 40,
        setStates: (dict) => {
            setCaptureState({ ...dict })
        },
    })
    const pc = useRef<RTCPeerConnection>(null)
    const pc_data = useRef(null)
    const stream = useRef<MediaStream>(null)

    const negotiate = () => {
        return pc.current
            .createOffer()
            .then(function (offer) {
                return pc.current.setLocalDescription(offer)
            })
            .then(function () {
                // wait for ICE gathering to complete
                return new Promise<void>((resolve) => {
                    if (pc.current.iceGatheringState === 'complete') {
                        resolve()
                    } else {
                        const checkState = () => {
                            if (pc.current.iceGatheringState === 'complete') {
                                pc.current.removeEventListener(
                                    'icegatheringstatechange',
                                    checkState
                                )
                                resolve()
                            }
                        }
                        pc.current.addEventListener(
                            'icegatheringstatechange',
                            checkState
                        )
                    }
                })
            })
            .then(function () {
                var offer = pc.current.localDescription

                const message = JSON.stringify({
                    type: 'offer',
                    offer: {
                        sdp: offer.sdp,
                        type: offer.type,
                    },
                })

                wsEvent.emit('wsSwiftTx', message)

                // ws.send(message)
            })
    }

    const ws_rtc_offer = (data) => {
        pc.current.setRemoteDescription(data)
        
    }

    useEffect(() => {
        let socket = true
        setHasMounted(true)

        let port = props.port

        if (port === 0) {
            port = parseInt(window.location.search.substring(1))
        }

        if (port === null) {
            socket = false
        }

        if (socket) {
            ws.current = new WebSocket('ws://localhost:' + port + '/')
            ws.current.onopen = () => {
                ws.current.onclose = () => {
                    setTimeout(() => {
                        window.close()
                    }, 5000)
                }

                ws.current.send('Connected')
                setConnected(true)
            }
            wsEvent.on('wsSwiftTx', (data) => {
                ws.current.send(data)
            })
        }

        wsEvent.on('wsRx', (func, data) => {
            console.log(func, data)
            ws_funcs[func](data)
        })

        pc.current = new RTCPeerConnection();

        const canvas = document.querySelector('canvas') as CanvasElement;
        console.log(canvas)

        stream.current = canvas.captureStream(5);
        console.log(stream)

        // stream.current.getTracks().forEach(
        //     track => {
        //         pc.current.addTrack(
        //             track,
        //             stream.current
        //         );
        //     }
        // );

        const dataChannelParams = { ordered: false };
        pc_data.current = pc.current.createDataChannel('sendDataChannel', dataChannelParams)
        pc_data.current.onopen = () => {
            console.log("CONNECTED")
            setRtcConnected(true)
        }

        negotiate();

        // navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        //     stream.getTracks().forEach(function (track) {
        //         pc.current.addTrack(track, stream);
        //     });
        //     return negotiate(ws.current);
        // }, function (err) {
        //     alert('Could not acquire media: ' + err);
        // });
    }, [])

    const sendData = (data) => {
        const timeBefore = performance.now();
        pc_data.current.send(data);
        const timeUsed = performance.now() - timeBefore;
        console.log(timeUsed)
    }

    const ws_shape_mounted = (data) => {
        {
            const id = data[0]
            const len = data[1]

            try {
                let loaded = 0
                shapes.current.children[id].children.forEach((ob, i) => {
                    if (ob.name === 'loaded') {
                        loaded++
                    }
                })

                if (loaded === len) {
                    wsEvent.emit('wsSwiftTx', '1')
                } else {
                    wsEvent.emit('wsSwiftTx', '0')
                }
            } catch (err) {
                wsEvent.emit('wsSwiftTx', '0')
            }
        }
    }

    const ws_shape = (data) => {
        const id = shapeDesc.length.toString()
        setShapeDesc([...shapeDesc, data])
        wsEvent.emit('wsSwiftTx', id)
    }

    const ws_remove = (data) => {
        const newShapeDesc = [...shapeDesc]
        newShapeDesc[data] = []
        setShapeDesc(newShapeDesc)
        wsEvent.emit('wsSwiftTx', '0')
    }

    const ws_shape_poses = (data) => {
        if (Object.keys(formState.formData).length !== 0) {
            wsEvent.emit('wsSwiftTx', JSON.stringify(formState.formData))

            formDispatch({
                type: 'reset',
                indices: Object.keys(formState.formData),
            })
        } else {
            wsEvent.emit('wsSwiftTx', '[]')
        }

        data.forEach((object) => {
            const id = object[0]
            const group = object[1]

            group.forEach((pose, i) => {
                shapes.current.children[id].children[i].position.set(
                    pose.t[0],
                    pose.t[1],
                    pose.t[2]
                )

                let quat = new THREE.Quaternion(
                    pose.q[0],
                    pose.q[1],
                    pose.q[2],
                    pose.q[3]
                )

                shapes.current.children[id].children[
                    i
                ].setRotationFromQuaternion(quat)
            })
        })

        // setCapture()
        setCaptureState({ ...captureState, shouldCapture: true })
    }

    const ws_sim_time = (data) => {
        setTime(parseFloat(data))
    }

    const ws_close = (data) => {
        ws.current.close()
        window.close()
    }

    const ws_element = (data) => {
        formDispatch({ type: 'newElement', data: data })
        wsEvent.emit('wsSwiftTx', '0')
    }

    const ws_update_element = (data) => {
        formDispatch({
            type: 'wsUpdate',
            index: data.id,
            data: data,
        })
    }

    const ws_camera_pose = (data) => {
        setCameraPosition(data.t)
        setCameraLookAt(data.look_at)
    }

    const ws_start_recording = (data) => {
        setCaptureState({
            ...captureState,
            format: data[2],
            framerate: data[0],
            filename: data[1],
            startRecord: true,
        })
        // loadCapture(parseFloat(data[0]), data[2], data[1])
        // startRecording()

        wsEvent.emit('wsSwiftTx', '0')
    }

    const ws_stop_recording = (data) => {
        setCaptureState({ ...captureState, stopRecord: true })
        wsEvent.emit('wsSwiftTx', '0')
    }

    const ws_screenshot = (data) => {
        setCaptureState({
            ...captureState,
            screenshot: true,
            snap_filename: data[0],
        })
        wsEvent.emit('wsSwiftTx', '0')
    }

    const ws_funcs = {
        shape_mounted: ws_shape_mounted,
        shape: ws_shape,
        remove: ws_remove,
        shape_poses: ws_shape_poses,
        sim_time: ws_sim_time,
        close: ws_close,
        element: ws_element,
        update_element: ws_update_element,
        camera_pose: ws_camera_pose,
        start_recording: ws_start_recording,
        stop_recording: ws_stop_recording,
        screenshot: ws_screenshot,
        offer: ws_rtc_offer,
    }

    useEffect(() => {

        wsEvent.on('rtcImage', (data) => {
            if (rtcConnected) {
                const canvas = document.querySelector('canvas') as CanvasElement;
                const im = canvas.toDataURL('image/jpeg')
                sendData(im)
            } else {
                console.log("not connected")
            }
        })

        if (ws.current) {
            ws.current.onmessage = (event) => {
                const eventdata = JSON.parse(event.data)
                const func = eventdata[0]
                const data = eventdata[1]
                wsEvent.emit('wsRx', func, data)
            }
        }
    }, [shapeDesc, formState, rtcConnected])

    return (
        <div className={styles.swiftContainer}>
            <FormDispatch.Provider value={formDispatch}>
                <SwiftInfo
                    time={time}
                    connected={connected}
                    screenshot={() =>
                        setCaptureState({ ...captureState, screenshot: true })
                    }
                />
                <SwiftBar elements={formState.formElements} />
            </FormDispatch.Provider>

            <Canvas
                gl={{ antialias: true, preserveDrawingBuffer: true }}
                id={'threeCanvas'}
            >
                <Capture {...captureState} />
                <Camera t={cameraPosition} />
                {hasMounted && (
                    <Suspense fallback={null}>
                        <Controls look_at={cameraLookAt} />
                    </Suspense>
                )}
                <hemisphereLight groundColor={new THREE.Color(0x111122)} />
                <ShadowedLight
                    x={10}
                    y={10}
                    z={10}
                    color={0xffffff}
                    intensity={0.2}
                />
                <ShadowedLight
                    x={-10}
                    y={-10}
                    z={10}
                    color={0xffffff}
                    intensity={0.2}
                />

                <Plane />
                <axesHelper args={[100]} />

                <GroupCollection meshes={shapeDesc} ref={shapes} />
            </Canvas>
        </div>
    )
}

export default Swift
