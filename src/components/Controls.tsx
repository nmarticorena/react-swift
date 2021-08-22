import React, { useRef, useEffect, useState } from 'react'
import { extend, useThree, useFrame, ReactThreeFiber } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

extend({ OrbitControls })

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
        interface IntrinsicElements {
            orbitControls: ReactThreeFiber.Object3DNode<
                OrbitControls,
                typeof OrbitControls
            >
        }
    }
}

export interface IControlProps {
    look_at?: number[]
}

const Controls = (props: IControlProps): JSX.Element => {
    const {
        camera,
        gl: { domElement },
    } = useThree()

    // Ref to the controls, so that we can update them on every frame using useFrame
    const controls = useRef<OrbitControls>()

    useFrame(() => controls.current.update())

    useEffect(() => {
        controls.current.target = new THREE.Vector3(
            props.look_at[0],
            props.look_at[1],
            props.look_at[2]
        )
    }, [props.look_at])

    return <orbitControls ref={controls} args={[camera, domElement]} />
}

export default Controls
