import * as THREE from 'three'
THREE.Object3D.DefaultUp.set(0, 0, 1)
import React, { useState, useEffect, useReducer, useRef, Suspense, useMemo } from 'react'
import { Canvas, useFrame, useThree, createPortal } from '@react-three/fiber'
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
import { connectRTC } from './RTC'

import Controls from './Controls'
import { send } from 'process'
import { finished } from 'stream'

import { PerspectiveCamera, OrthographicCamera, useCamera } from '@react-three/drei'


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
    const [dataParams, setDataParams] = useState<IDataParams>({
        chunkSize: 0,
        lowWaterMark: 0,
        highWaterMark: 0,
    })
    const [dataMessage, setDataMessage] = useState<IDataMessage>({
        sendProgress: 0,
        data: '',
        finished: true
    })
    const pc = useRef<RTCPeerConnection>(null)
    const pcDataChannel = useRef<RTCDataChannel>(null)


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

        if (ws.current) {
            ws.current.onmessage = (event) => {
                const eventdata = JSON.parse(event.data)
                const func = eventdata[0]
                const data = eventdata[1]
                wsEvent.emit('wsRx', func, data)
            }
        }
    }, [])


    useEffect(() => {
        wsEvent.removeAllListeners('rtcLowWater')
        wsEvent.on('rtcLowWater', (data) => {
            sendData(false)
        })

        wsEvent.removeAllListeners('wsRx')
        wsEvent.on('wsRx', (func, data) => {
            ws_funcs[func](data)
        })
    }, [shapeDesc, formState, rtcConnected, dataParams, dataMessage])

    const onOpenRTC = () => {
        console.log("OPENED")
        setRtcConnected(true)

        const chunkSize = pc.current.sctp.maxMessageSize

        setDataParams({
            chunkSize: chunkSize,
            lowWaterMark: chunkSize,
            highWaterMark: 1 * chunkSize,
        })

        pcDataChannel.current.bufferedAmountLowThreshold = chunkSize;

        pcDataChannel.current.addEventListener('bufferedamountlow', (e) => {
            wsEvent.emit('rtcLowWater', false)
        });

        sendData(true)
    }

    const onCloseRTC = () => {
        setRtcConnected(false)
    }

    const sendData = (connected: boolean, customDataMessage?: IDataMessage) => {
        // const timeBefore = performance.now();

        const data = customDataMessage ? customDataMessage : dataMessage

        if (data.finished || (!rtcConnected && !connected)) {
            return
        }

        // console.log(data.sendProgress)

        // If message is at the start
        if (data.sendProgress === 0) {
            pcDataChannel.current.send('imageStarting');
        }

        let sendProgress = data.sendProgress
        let dataLengthRemaining = data.data.length - sendProgress
        

        while (dataLengthRemaining > 0) {

            if (pcDataChannel.current.bufferedAmount > dataParams.highWaterMark) {
                // console.log("HIGH TIDE")
                setDataMessage({
                    ...data,
                    sendProgress: sendProgress
                })

                return
            }

            const dataLengthToSend = Math.min(dataParams.chunkSize, dataLengthRemaining)

            pcDataChannel.current.send(data.data.slice(sendProgress, sendProgress + dataLengthToSend));

            // Update remaining amount
            dataLengthRemaining = dataLengthRemaining - dataLengthToSend
            sendProgress += dataLengthToSend
        }

        // If we made it this far, we finished the image
        setDataMessage({
            ...data, finished: true
        })

        pcDataChannel.current.send('imageFinished');
        
        // Let python know
        wsEvent.emit('wsSwiftTx', '1')
        // console.log('Message Fin')

        // const timeUsed = performance.now() - timeBefore;
        // console.log(timeUsed)
    }

    const ws_get_frame = (data) => {
        // console.log('Frame Request')
        const canvas = document.getElementById('ccanvas') as CanvasElement;
        const im = canvas.toDataURL('image/jpeg', 0.9)

        const dataMessage = {
            sendProgress: 0,
            data: im,
            finished: false
        }

        setDataMessage(dataMessage)

        sendData(false, dataMessage)
    }

    const ws_open_rtc = (data) => {
        pc.current = new RTCPeerConnection();
        pcDataChannel.current = connectRTC(pc.current, onOpenRTC, onCloseRTC)
    }

    const ws_rtc_offer = (data) => {
        console.log(data)
        pc.current.setRemoteDescription(data)
        
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
        get_frame: ws_get_frame,
        open_rtc: ws_open_rtc
    }

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
                shadows={true}
                gl={{ antialias: true, preserveDrawingBuffer: true}}
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
                <UserCamera />
            </Canvas>
            <canvas id={'ccanvas'} style={{height: '1280', width: '720', display: 'none'}}>
            </canvas>
        </div>
    )
}

const UserCamera = () => {
    const virtualCam = useRef<THREE.PerspectiveCamera>()
    const canvas = document.getElementById('ccanvas') as CanvasElement
    const height = 720
    const width = 1280
    
    const r2 = useMemo(() => {
        const render = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            preserveDrawingBuffer: true,
        })
        render.setSize(width, height)
        render.setClearAlpha(0)
        render.shadowMap.type = THREE.PCFSoftShadowMap
        render.shadowMap.enabled = true
        render.outputEncoding = THREE.sRGBEncoding
        render.toneMapping = THREE.ACESFilmicToneMapping
        return render
    }, [])

    useFrame(({scene}) => {
        r2.render(scene, virtualCam.current)
    }, 10)

    useEffect(() => {
        virtualCam.current.lookAt(0, 0, 0)
    }, [])

    return (
        <>
            <PerspectiveCamera
                makeDefault={false}
                ref={virtualCam}
                position={[0.2, 1.2, 0.7]}
                near={0.01}
                far={100}
                fov={70}
                aspect={720 / 1280}
            />
        </>
    )
}

// const CCamera = () => {
//     const { gl, scene, camera, size } = useThree()
//     const virtualScene = useMemo(() => new THREE.Scene(), [])
//     const virtualCam = useRef()
//     const ref = useRef()
//     const [hover, set] = useState(null)
//     const matrix = new THREE.Matrix4()
//     const canvas = document.getElementById('ccanvas') as CanvasElement
//     const height = 720
//     const width = 1280
    
//     const r2 = useMemo(() => {
//         const render = new THREE.WebGLRenderer({
//             canvas: canvas,
//             antialias: true,
//             alpha: true,
//             powerPreference: "high-performance",
//             preserveDrawingBuffer: true,
//         })
//         render.setSize(width, height)
//         render.setClearAlpha(0)
//         render.shadowMap.type = THREE.PCFSoftShadowMap
//         render.shadowMap.enabled = true
//         render.outputEncoding = THREE.sRGBEncoding
//         render.toneMapping = THREE.ACESFilmicToneMapping
//         return render
//     }, [])


//     // r2.setPixelRatio(height/width)

//     useFrame(({gl, scene, camera}) => {

//         r2.render(scene, camera)

//         // matrix.copy(camera.matrix).invert()
//         // ref.current.quaternion.setFromRotationMatrix(matrix)
//         // gl.autoClear = false

//         // gl.render(scene, camera)

//         // gl.setRenderTarget(rt)
//         // gl.render(scene, camera)
//         // gl.readRenderTargetPixels(rt, 0, 0, width, height, pixels );

//         // for (let i = 0; i < imData.data.length; i += 4) {
//         //     // img_data[i] = pixels[i];
//         //     imData.data[i + 0] = pixels[i]  // R value
//         //     imData.data[i + 1] = pixels[i + 1]    // G value
//         //     imData.data[i + 2] = pixels[i + 2]  // B value
//         //     imData.data[i + 3] = pixels[i + 3]  // A value
//         // }
//         // imData.data.set(pixels)

//         // console.log(pixels)
//         // ctx.putImageData(imData, 0, 0);
//         // ctx.drawImage(gl.domElement, 0,0, 200, 200, 0, 0, 200, 200)


//         gl.render(scene, camera)

//         // gl.autoClear = false
//         // gl.clearDepth()
//         // gl.render(virtualScene, virtualCam.current)
//       }, 1)

//     return <> </>

//     // return createPortal(
//     //     <>
//     //         <OrthographicCamera ref={virtualCam} makeDefault={false} position={[0, 0, 100]} />
//     //         <mesh
//     //             ref={ref}
//     //             raycast={useCamera(virtualCam)}
//     //             position={[size.width / 2 - 80, size.height / 2 - 80, 0]}
//     //             onPointerOut={(e) => set(null)}
//     //             onPointerMove={(e) => set(Math.floor(e.faceIndex / 2))}>
//     //             {[...Array(6)].map((_, index) => (
//     //             <meshLambertMaterial attachArray="material" key={index} color={hover === index ? 'hotpink' : 'white'} />
//     //             ))}
//     //             <boxGeometry args={[60, 60, 60]} />
//     //         </mesh>
//     //         <ambientLight intensity={0.5} />
//     //         <pointLight position={[10, 10, 10]} intensity={0.5} />
//     //     </>, virtualScene
//     // )
// }

export default Swift
