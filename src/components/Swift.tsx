import * as THREE from 'three'
import { Vector3 } from 'three'
THREE.Object3D.DEFAULT_UP = new Vector3(0, 0, 1)
import React, {
    useState,
    useEffect,
    useReducer,
    useRef,
    Suspense,
    useCallback,
} from 'react'
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
import { connectRTC } from './RTC'


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

interface IDataParams {
    chunkSize: number
    lowWaterMark: number
    highWaterMark: number
}

interface IDataMessage {
    sendProgress: number
    data: string
    finished: boolean
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
    const [dataParams, setDataParams] = useState<IDataParams>({
        chunkSize: 0,
        lowWaterMark: 0,
        highWaterMark: 0,
    })
    const [dataMessage, setDataMessage] = useState<IDataMessage>({
        sendProgress: 0,
        data: '',
        finished: true,
    })
    const pc = useRef<RTCPeerConnection>(null)
    const pcDataChannel = useRef<RTCDataChannel>(null)

    useEffect(() => {
        let socket = false
        setHasMounted(true)

        let port = props.port

        const server_params = window.location.search.substring(1).split('&')
        console.log(server_params)

        if (port === 0) {
            port = parseInt(server_params[0])
        }

        if (port === null) {
            socket = false
        }


        // We're going with web sockets

        let ws_url = 'ws://localhost:' + port + '/'

        if (socket) {
            ws.current = new WebSocket(ws_url)
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
                console.log(data)
                ws.current.send(data)
            })
        }

        if (ws.current) {
            ws.current.onmessage = (event) => {
                const eventdata = JSON.parse(event.data)
                const func = eventdata[0]
                const data = eventdata[1]
                wsEvent.emit('wsRx', func, data)
            }
        }

        // Start the RTC connection
        var config = {
            sdpSemantics: 'unified-plan'
        };

        config.iceServers = [{ urls: ['stun:stun.l.google.com:19302'] }];

        pc.current = new RTCPeerConnection(config)
        pcDataChannel.current = connectRTC(pc.current, onOpenRTC, onCloseRTC)

    }, [])

    useEffect(() => {
        wsEvent.removeAllListeners('rtcLowWater')
        wsEvent.on('rtcLowWater', (data) => {
            sendData(false)
        })

        wsEvent.removeAllListeners('wsRx')
        wsEvent.on('wsRx', (func, data) => {
            console.log(func)
            ws_funcs[func](data)
        })

        wsEvent.removeAllListeners('wsSwiftTx')
        wsEvent.on('wsSwiftTx', (data) => {
            console.log(data)
            const dataMessage = {
                sendProgress: 0,
                data: data,
                finished: false,
            }

            setDataMessage(dataMessage)

            sendData(false, dataMessage)
        })
    }, [shapeDesc, formState, rtcConnected, dataParams, dataMessage])

    const onOpenRTC = () => {
        console.log('OPENED')
        setRtcConnected(true)

        const chunkSize = pc.current.sctp.maxMessageSize

        setDataParams({
            chunkSize: chunkSize,
            lowWaterMark: chunkSize,
            highWaterMark: 1 * chunkSize,
        })

        pcDataChannel.current.bufferedAmountLowThreshold = chunkSize

        pcDataChannel.current.addEventListener('bufferedamountlow', (e) => {
            wsEvent.emit('rtcLowWater', false)
        })

        sendData(true)


    }

    const onCloseRTC = () => {
        console.log("CLOSED RTC CONNECTION")
        setRtcConnected(false)
    }

    const sendData = (connected: boolean, customDataMessage?: IDataMessage) => {
        // const timeBefore = performance.now();

        const data = customDataMessage ? customDataMessage : dataMessage

        if (data.finished || (!rtcConnected && !connected)) {
            return
        }

        // If message is at the start
        // if (data.sendProgress === 0) {
        //     pcDataChannel.current.send('imageStarting')
        // }

        let sendProgress = data.sendProgress
        let dataLengthRemaining = data.data.length - sendProgress

        while (dataLengthRemaining > 0) {
            if (
                pcDataChannel.current.bufferedAmount > dataParams.highWaterMark
            ) {
                // console.log("HIGH TIDE")
                setDataMessage({
                    ...data,
                    sendProgress: sendProgress,
                })

                return
            }

            const dataLengthToSend = Math.min(
                dataParams.chunkSize,
                dataLengthRemaining
            )

            pcDataChannel.current.send(
                data.data.slice(sendProgress, sendProgress + dataLengthToSend)
            )

            // Update remaining amount
            dataLengthRemaining = dataLengthRemaining - dataLengthToSend
            sendProgress += dataLengthToSend
        }

        // If we made it this far, we finished the image
        setDataMessage({
            ...data,
            finished: true,
        })

        // // Let python know
        // wsEvent.emit('wsSwiftTx', '1')

        // const timeUsed = performance.now() - timeBefore;
        // console.log(timeUsed)
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
        console.log(id)
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

    const ws_get_frame = (data) => {
        // console.log('Frame Request')
        const canvas = document.getElementById(data) as CanvasElement
        const im = canvas.toDataURL('image/jpeg', 0.9)

        const dataMessage = {
            sendProgress: 0,
            data: im,
            finished: false,
        }

        setDataMessage(dataMessage)

        sendData(false, dataMessage)
    }

    const ws_open_rtc = (data) => {
        pc.current = new RTCPeerConnection()
        pcDataChannel.current = connectRTC(pc.current, onOpenRTC, onCloseRTC)
    }

    const ws_rtc_offer = (data) => {
        console.log(data)
        pc.current.setRemoteDescription(data)
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
        get_frame: ws_get_frame,
        open_rtc: ws_open_rtc,
    }

    // useEffect(() => {
    //     // if (ws.current) {
    //     //     ws.current.onmessage = (event) => {
    //     //         const eventdata = JSON.parse(event.data)
    //     //         const func = eventdata[0]
    //     //         const data = eventdata[1]
    //     //         wsEvent.emit('wsRx', func, data)
    //     //     }
    //     // }
    // }, [shapeDesc, formState])

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
