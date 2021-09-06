import * as THREE from 'three'
THREE.Object3D.DefaultUp.set(0, 0, 1)
import React, {
    useState,
    useEffect,
    useCallback,
    useReducer,
    useRef,
    Suspense,
} from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useCapture } from './Recorder'
import SwiftInfo from '../components/SwiftInfo'
import SwiftBar, { ISwiftBar, ISwiftElement } from '../components/SwiftBar'
import styles from '../styles/Swift.module.scss'
import formReducer, { DEFUALT_ELEMENTS } from './Swift.reducer'
import { FormDispatch } from './FormDispatch'
import { Stats } from '@react-three/drei'
import { IControlProps } from './Controls'
import {
    Plane,
    ShadowedLight,
    Camera,
    IShapeProps,
    Shape,
} from './SwiftComponents'

// const Controls = lazy(() => import('./Controls'))
import Controls from './Controls'

interface IMeshCollection {
    meshes: IShapeProps[]
}

const MeshCollection = (props: IMeshCollection): JSX.Element => {
    // console.log(props)
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

interface CanvasElement extends HTMLCanvasElement {
    captureStream(frameRate?: number): MediaStream
}

// interface StreamElement extends MediaStream {
//     videoTracks(): MediaStreamTrack[];
// }

const Swift: React.FC<ISwiftProps> = (props: ISwiftProps): JSX.Element => {
    const [hasMounted, setHasMounted] = useState(false)
    const [time, setTime] = useState(0.0)
    const [FPS, setFPS] = useState('60 fps')
    const [frameTime, setFrameTime] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const [frameI, setFrameI] = useState(0)
    const shapes = useRef<THREE.Group>()
    const ws = useRef<WebSocket>(null)
    const [shapeDesc, setShapeDesc] = useState<IShapeProps[][]>([])
    const [connected, setConnected] = useState(false)
    const [formState, formDispatch] = useReducer(formReducer, {
        formData: {},
        formElements: [],
    })
    const [cameraPosition, setCameraPosition] = useState([0.2, 1.2, 0.7])
    const [cameraLookAt, setCameraLookAt] = useState([0, 0, 0.2])

    // const pc = useRef<RTCPeerConnection>(null)
    // const stream = useRef<MediaStream>(null)

    const [bind, startRecording, stopRecording, loadCapture, screenshot] =
        useCapture()

    const setFrames = useCallback((delta) => {
        let newFrameTime = [...frameTime]
        let newFrameI = frameI
        let total = 0

        newFrameI += 1
        if (newFrameI >= 10) {
            newFrameI = 0
        }

        newFrameTime[newFrameI] = delta

        for (let j = 0; j < 10; j++) {
            total += newFrameTime[j]
        }

        total = Math.round(total / 10.0)

        // setFrameTime(newFrameTime)
        // setFrameI(newFrameI)
        // if (total === Infinity) {
        //     total = 60
        // }
        // setFPS(`${total} fps`)
    }, [])

    // const negotiate = (ws) => {
    //     return pc.current
    //         .createOffer()
    //         .then(function (offer) {
    //             return pc.current.setLocalDescription(offer)
    //         })
    //         .then(function () {
    //             // wait for ICE gathering to complete
    //             return new Promise<void>((resolve) => {
    //                 if (pc.current.iceGatheringState === 'complete') {
    //                     resolve()
    //                 } else {
    //                     const checkState = () => {
    //                         if (pc.current.iceGatheringState === 'complete') {
    //                             pc.current.removeEventListener(
    //                                 'icegatheringstatechange',
    //                                 checkState
    //                             )
    //                             resolve()
    //                         }
    //                     }
    //                     pc.current.addEventListener(
    //                         'icegatheringstatechange',
    //                         checkState
    //                     )
    //                 }
    //             })
    //         })
    //         .then(function () {
    //             var offer = pc.current.localDescription

    //             const message = JSON.stringify({
    //                 type: 'offer',
    //                 offer: {
    //                     sdp: offer.sdp,
    //                     type: offer.type,
    //                 },
    //             })

    //             ws.send(message)
    //         })
    // }

    useEffect(() => {
        setHasMounted(true)

        let port = props.port

        if (port === 0) {
            port = parseInt(window.location.search.substring(1))
        }

        if (!port) {
            port = 0
        }

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

        // pc.current = new RTCPeerConnection();

        // const canvas = document.querySelector('canvas') as CanvasElement;
        // console.log(canvas)

        // stream.current = canvas.captureStream(5);
        // console.log(stream)

        // stream.current.getTracks().forEach(
        //     track => {
        //         pc.current.addTrack(
        //             track,
        //             stream.current
        //         );
        //     }
        // );
        // return negotiate(ws.current);

        // navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
        //     stream.getTracks().forEach(function(track) {
        //         pc.current.addTrack(track, stream);
        //     });
        //     return negotiate(ws.current);
        // }, function(err) {
        //     alert('Could not acquire media: ' + err);
        // });
    }, [])

    useEffect(() => {
        ;(ws.current.onmessage = (event) => {
            const eventdata = JSON.parse(event.data)
            const func = eventdata[0]
            const data = eventdata[1]

            switch (func) {
                // case 'offer':
                //     pc.current.setRemoteDescription(data)
                //     break

                case 'shape_mounted':
                    {
                        const id = data[0]
                        const len = data[1]

                        try {
                            let loaded = 0
                            shapes.current.children[id].children.forEach(
                                (ob, i) => {
                                    if (ob.name === 'loaded') {
                                        loaded++
                                    }
                                }
                            )

                            if (loaded === len) {
                                ws.current.send('1')
                            } else {
                                ws.current.send('0')
                            }
                        } catch (err) {
                            ws.current.send('0')
                        }
                    }
                    break

                case 'shape':
                    {
                        const id = shapeDesc.length.toString()
                        setShapeDesc([...shapeDesc, data])
                        ws.current.send(id)
                    }
                    break

                case 'remove':
                    const newShapeDesc = [...shapeDesc]
                    newShapeDesc[data] = []
                    setShapeDesc(newShapeDesc)
                    ws.current.send('0')
                    break

                case 'shape_poses':
                    if (Object.keys(formState.formData).length !== 0) {
                        ws.current.send(JSON.stringify(formState.formData))

                        formDispatch({
                            type: 'reset',
                            indices: Object.keys(formState.formData),
                        })
                    } else {
                        ws.current.send('[]')
                    }

                    data.forEach((object) => {
                        const id = object[0]
                        const group = object[1]

                        group.forEach((pose, i) => {
                            shapes.current.children[id].children[
                                i
                            ].position.set(pose.t[0], pose.t[1], pose.t[2])

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
                    break

                case 'sim_time':
                    setTime(parseFloat(data))
                    break

                case 'close':
                    ws.current.close()
                    window.close()
                    break

                case 'element':
                    formDispatch({ type: 'newElement', data: data })
                    ws.current.send('0')

                    break

                case 'update_element':
                    formDispatch({
                        type: 'wsUpdate',
                        index: data.id,
                        data: data,
                    })
                    break

                case 'camera_pose':
                    setCameraPosition(data.t)
                    setCameraLookAt(data.look_at)

                    break

                case 'start_recording':
                    loadCapture(parseFloat(data[0]), data[2], data[1])
                    startRecording()

                    ws.current.send('0')

                    break

                case 'stop_recording':
                    stopRecording()
                    ws.current.send('0')

                    break

                case 'screenshot':
                    screenshot(data[0])
                    ws.current.send('0')

                    break

                default:
                    break
            }
        }),
            [shapeDesc, formState]
    })

    return (
        <div className={styles.swiftContainer}>
            <FormDispatch.Provider value={formDispatch}>
                <SwiftInfo time={time} FPS={FPS} connected={connected} />
                <SwiftBar elements={formState.formElements} />
            </FormDispatch.Provider>

            <Canvas
                gl={{ antialias: true, preserveDrawingBuffer: true }}
                id={'threeCanvas'}
                onCreated={bind}
            >
                <Camera t={cameraPosition} fpsCallBack={setFrames} />
                {hasMounted && (
                    <Suspense fallback={null}>
                        <Controls look_at={cameraLookAt} />
                    </Suspense>
                )}
                {/* <Controls look_at={cameraLookAt} /> */}
                <hemisphereLight
                    // skyColor={new THREE.Color(0x443333)}
                    groundColor={new THREE.Color(0x111122)}
                />
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
            {/* < Loader /> */}
        </div>
    )
}

export default Swift
