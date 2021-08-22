import * as THREE from 'three'
import React, { useEffect, useState, useRef, Suspense, lazy } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { PerspectiveCamera, useProgress, Html } from '@react-three/drei'

THREE.Object3D.DefaultUp.set(0, 0, 1)
const Loader = lazy(() => import('./Loader'))

export const Plane: React.FC = (): JSX.Element => {
    const { scene } = useThree()

    scene.background = new THREE.Color(0x787878)
    scene.fog = new THREE.Fog(0x787878, 50, 60)

    return (
        <mesh receiveShadow={true}>
            <planeBufferGeometry args={[200, 200]} />
            <meshPhongMaterial
                color={0x4b4b4b}
                specular={new THREE.Color(0x101010)}
            />
        </mesh>
    )
}

export interface IShadowedLightProps {
    x: number
    y: number
    z: number
    color: number
    intensity: number
}

export const ShadowedLight: React.FC<IShadowedLightProps> = (
    props: IShadowedLightProps
): JSX.Element => {
    const light = useRef<THREE.DirectionalLight>()
    // const d = 1

    // useEffect(() => {
    // light.current.shadow.camera.left = -d
    // light.current.shadow.camera.right = d
    // light.current.shadow.camera.top = d
    // light.current.shadow.camera.bottom = -d
    // light.current.shadow.camera.near = 0
    // light.current.shadow.camera.far = 40
    // light.current.shadow.bias = -0.002
    // }, [])

    return (
        <directionalLight
            ref={light}
            color={props.color}
            intensity={props.intensity}
            position={[props.x, props.y, props.z]}
            castShadow={true}
        />
    )
}

export interface ICameraProps {
    fpsCallBack: any
    t: number[]
}

// export interface CameraPose {
//     t: number[]
//     q: number[]
//     look_at_origin: boolean

// }

export const Camera = (props: ICameraProps): JSX.Element => {
    // const { viewport, setDefaultCamera } = useThree()
    const { viewport, set } = useThree()

    const { width, height } = viewport

    const camera = useRef<THREE.PerspectiveCamera>()

    // useEffect(() => {
    //     // if (props.setDefault) {
    //     //     // setDefaultCamera(camera.current)
    //     //     set({ camera: camera.current })
    //     // }
    //     // camera.current.setRotationFromQuaternion(new THREE.Quaternion(props.pose.q[0], props.pose.q[1], props.pose.q[2], props.pose.q[3]))
    //     camera.current.lookAt(0, 5, 0)

    // }, [camera])

    useFrame((state, delta) => {
        props.fpsCallBack(1.0 / delta)
    })

    return (
        <PerspectiveCamera
            makeDefault
            ref={camera}
            position={[props.t[0], props.t[1], props.t[2]]}
            near={0.01}
            far={100}
            fov={70}
            aspect={height / width}
        />

        //     <perspectiveCamera
        //         ref={camera}
        //         position={[0.2, 1.2, 0.7]}
        //         near={0.01}
        //         far={100}
        //         fov={70}
        //         aspect={height / width}
        //     />
    )
}

const PrimativeShapes = (props: IShapeProps): JSX.Element => {
    switch (props.stype) {
        case 'box':
            return (
                <boxBufferGeometry
                    args={[props.scale[0], props.scale[1], props.scale[2]]}
                />
            )
            break

        case 'sphere':
            return <sphereBufferGeometry args={[props.radius, 64, 64]} />
            break

        case 'cylinder':
            return (
                <cylinderBufferGeometry
                    args={[props.radius, props.radius, props.length, 32]}
                />
            )
            break

        default:
            return (
                <boxBufferGeometry
                    args={[props.scale[0], props.scale[1], props.scale[2]]}
                />
            )
    }
}

export interface IShapeProps {
    stype: string
    scale?: number[]
    filename?: string
    radius?: number
    length?: number
    q?: number[]
    t?: number[]
    v?: number[]
    color?: number
    opacity?: number
    display?: boolean
}

const BasicShape = (props: IShapeProps): JSX.Element => {
    const shape = useRef<THREE.Mesh>()

    return (
        <mesh
            ref={shape}
            position={[props.t[0], props.t[1], props.t[2]]}
            quaternion={
                props.q
                    ? [props.q[0], props.q[1], props.q[2], props.q[3]]
                    : [1, 0, 0, 0]
            }
            castShadow={true}
            name={'loaded'}
        >
            <PrimativeShapes {...props} />
            <meshStandardMaterial
                transparent={props.opacity ? true : false}
                color={props.color ? props.color : 'hotpink'}
                opacity={props.opacity ? props.opacity : 1.0}
            />
        </mesh>
    )
}

const MeshShape = (props: IShapeProps): JSX.Element => {
    const [hasMounted, setHasMounted] = useState(false)

    useEffect(() => {
        setHasMounted(true)
    }, [])

    function FallLoader() {
        const { active, progress, errors, item, loaded, total } = useProgress()
        return <Html center>{Math.round(progress)} % loaded</Html>
    }

    return (
        <React.Fragment>
            {hasMounted && (
                <Suspense
                    fallback={
                        // <BasicShape
                        //     stype={'box'}
                        //     scale={[0.1, 0.1, 0.1]}
                        //     t={props.t}
                        //     // q={props.q}
                        //     opacity={0.1}
                        //     color={0xffffff}
                        // />
                        <FallLoader />
                    }
                >
                    <Loader {...props} />
                </Suspense>
            )}
        </React.Fragment>
    )
}

const AxesShape = (props: IShapeProps): JSX.Element => {
    const shape = useRef<THREE.Mesh>()

    return (
        <mesh
            ref={shape}
            position={[props.t[0], props.t[1], props.t[2]]}
            quaternion={[props.q[0], props.q[1], props.q[2], props.q[3]]}
            name={'loaded'}
        >
            <axesHelper args={[props.length]} />
        </mesh>
    )
}

export const Shape = (props: IShapeProps): JSX.Element => {
    if (props.display === false) {
        return <React.Fragment></React.Fragment>
    }

    switch (props.stype) {
        case 'mesh':
            return <MeshShape {...props} />
            break

        case 'axes':
            return <AxesShape {...props} />
            break

        case 'box':
        case 'cylinder':
        case 'sphere':
        default:
            return <BasicShape {...props} />
            break
    }
}
