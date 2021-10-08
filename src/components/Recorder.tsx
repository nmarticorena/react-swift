// Original Author: GitHub user gsimone
// Original URL: https://github.com/gsimone/use-capture/commit/c3cc4934ae2d48fa6b9da6aed509158d280b731d
// Licence: MIT
// Adapted by: Jesse haviland

import * as THREE from 'three'
import * as React from 'react'
import { useRef, useCallback, useMemo, useEffect, useState } from 'react'
// import { SharedCanvasContext } from 'react-three-fiber'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import wsEvent from './eventEmitter'

// type RecorderContext = [
//     // (context: SharedCanvasContext) => void,
//     () => void,
//     () => void,
//     () => void,
//     (framerate: number, format: string, filename: string) => void,
//     (filename: string) => void,
//     () => void,
//     {
//         playhead: number
//         duration: number
//         getProgress: () => number
//         getPlayhead: () => number
//     }
// ]

// type RecorderProps = {
//     format: 'webm' | 'gif' | 'jpeg'
//     duration: number
//     framerate: number
//     fps: number
//     verbose: boolean
//     motionBlurFrames: number
//     children: React.ReactNode
//     showWidget: boolean
//     filename: string
// }

// const state = {
//     shouldRecord: false,
//     prevPlayhead: 0,
//     isRecording: false,
//     playhead: 0,
//     duration: 0,
//     screenshot: false,
//     capture: true,
// }

// Future CCapture Import
let cc = null

// Future CCapture Import for tars (png, jpeg)
let cct = null

// // let capturer = null
// let ext = null
// let fname = null
// let ss_filename = null

// const startRecording = () => {
//     state.playhead = 0
//     state.isRecording = true
//     capturer.start()
// }

// const stopRecording = () => {
//     state.shouldRecord = false
//     state.isRecording = false
//     capturer.stop()
//     capturer.save((blob: Blob) => {
//         const fileURL = window.URL.createObjectURL(blob)
//         const tempLink = document.createElement('a')
//         tempLink.href = fileURL
//         tempLink.setAttribute('download', `${fname}.${getExtension(ext)}`)
//         tempLink.click()
//     })
// }

// const getProgress = () => {
//     return state.playhead / state.duration
// }

// const getPlayhead = () => {
//     return state.playhead
// }

// const setCapture = () => {
//     state.capture = true
// }

// const loadCapture = (framerate, format, filename) => {
//     ext = format
//     fname = filename
//     // console.log(format)

//     if (format === 'webm' || format === 'gif') {
//         capturer = new cc({
//             format,
//             framerate,
//             verbose: false,
//             motionBlurFrames: false,
//             display: false,
//             quality: 100,
//             workersPath: './',
//         })
//     } else {
//         capturer = new cct({
//             format,
//             framerate,
//             verbose: false,
//             motionBlurFrames: false,
//             display: false,
//             quality: 100,
//             workersPath: './',
//         })
//     }
// }

// const screenshot = (filename) => {
//     ss_filename = filename
//     state.screenshot = true
// }

const saveFile = (strData, filename) => {
    let link = document.createElement('a')
    if (typeof link.download === 'string') {
        document.body.appendChild(link) //Firefox requires the link to be in the body
        link.download = filename
        link.href = strData
        link.click()
        document.body.removeChild(link) //remove the link when done
    }
}

export interface ICaptureProps {
    screenshot: boolean
    startRecord: boolean
    stopRecord: boolean
    isRecording: boolean
    shouldCapture: boolean
    ext: string
    filename: string
    snap_filename: string
    format: string
    framerate: number
    setStates: (dict) => void
}

let capturer = null

const Capture = (props: ICaptureProps): JSX.Element => {
    const gl = useThree((state) => state.gl)
    const camera = useThree((state) => state.camera)
    const scene = useThree((state) => state.scene)
    // const capturer = useRef()

    useEffect(() => {
        if (cc === null) {
            import('./ccapture.js/src/CCapture.js').then((cap) => {
                cc = cap.default
            })
        }

        if (cct === null) {
            import('./ccapture.js/build/CCapture.min.js').then((cap) => {
                cct = cap.default
            })
        }
    }, [])

    // const renderer = (gl, scene, camera) => {
    //     // const cap = () => {
    //     //     requestAnimationFrame(cap)

    //     //     if (props.isRecording) {
    //     //         capturer.current.capture(gl.domElement)
    //     //     }
    //     // }
    //     // gl.render(scene, camera)

    //     // requestAnimationFrame(renderer)

    //     cap()
    // }

    // useFrame(({ gl, scene, camera }) => {
    //     // renderer(gl, scene, camera)

    // }, 1)

    const capturer = useMemo(() => {
        // if (props.format === 'webm' || props.format === 'gif') {
        if (!cc || !cct) {
            return null
        } else if (cc && (props.format === 'webm' || props.format === 'gif')) {
            return new cc({
                format: props.format,
                framerate: props.framerate,
                verbose: true,
                motionBlurFrames: false,
                display: true,
                quality: 100,
                workersPath: './',
            })
        } else {
            return new cct({
                format: props.format,
                framerate: props.framerate,
                verbose: true,
                motionBlurFrames: false,
                display: true,
                quality: 100,
                workersPath: './',
            })
        }

        // )
    }, [props.format, props.framerate])

    useEffect(() => {
        if (props.startRecord) {
            // console.log('HUIGHIUG')

            // } else {
            //     capturer.current = new cct({
            //         format: props.format,
            //         framerate: props.framerate,
            //         verbose: false,
            //         motionBlurFrames: false,
            //         display: false,
            //         quality: 100,
            //         workersPath: './',
            //     })
            // }
            props.setStates({
                ...props,
                startRecord: false,
                isRecording: true,
                shouldCapture: true,
            })
            // console.log(capturer)
            capturer.start()
            // gl.render(scene, camera)
        }

        if (props.stopRecord) {
            capturer.stop()
            capturer.save((blob: Blob) => {
                const fileURL = window.URL.createObjectURL(blob)
                const tempLink = document.createElement('a')
                tempLink.href = fileURL
                tempLink.setAttribute(
                    'download',
                    `${props.filename}.${getExtension(props.format)}`
                )
                tempLink.click()
            })
            props.setStates({
                ...props,
                stopRecord: false,
                isRecording: false,
            })
        }

        if (props.screenshot) {
            let im = gl.domElement.toDataURL('image/png')
            saveFile(im, props.snap_filename + '.png')
            props.setStates({
                ...props,
                screenshot: false,
            })
        }
    }, [props.startRecord, props.stopRecord, props.screenshot])

    useFrame(({ gl, scene, camera }) => {
        if (!props.isRecording) {
            gl.render(scene, camera)
        }

        if (
            props.isRecording &&
            (props.format === 'jpeg' ||
                props.format === 'png' ||
                props.format === 'gif')
        ) {
            gl.render(scene, camera)
            capturer.capture(gl.domElement)
        } else if (props.isRecording && props.shouldCapture) {
            gl.render(scene, camera)
            capturer.capture(gl.domElement)
            props.setStates({
                ...props,
                shouldCapture: false,
            })
        }

        wsEvent.emit('rtcImage', 1)
        // else if (props.isRecording && !props.shouldCapture) {
        //     capturer.capture(gl.domElement)
        // }
    }, 1)

    return <></>
}

export default Capture

// export function useCapture(): RecorderContext {

//     const [clock] = useState(new THREE.Clock())
//     const gl = useRef<THREE.WebGLRenderer>()

//     // const bind = useCallback((context: SharedCanvasContext) => {
//     //     gl.current = context.gl
//     // }, [])

//     const bind = () => {}

//     // const loop = useCallback(() => {
//     //     if (state.isRecording) {
//     //         if (gl.current) {
//     //             if (state.capture) {
//     //                 // state.capture = false
//     //                 capturer.capture(gl.current.domElement)
//     //             }
//     //         } else {
//     //             throw new Error('Missing gl')
//     //         }
//     //     }

//     //     if (state.screenshot) {
//     //         if (gl.current) {
//     //             state.screenshot = false
//     //             let im = gl.current.domElement.toDataURL('image/png')
//     //             saveFile(im, ss_filename + '.png')
//     //         } else {
//     //             throw new Error('Missing gl')
//     //         }
//     //     }

//     //     requestAnimationFrame(loop)
//     // }, [])

//     // useEffect(() => {
//     //     requestAnimationFrame(loop)
//     // }, [loop])

//     useFrame((state, delta) => {
//         // if (state.isRecording) {
//         //     if (gl.current) {
//         //         if (state.capture) {
//         //             // state.capture = false
//         //             // capturer.capture(gl.current.domElement)
//         //         }
//         //     } else {
//         //         throw new Error('Missing gl')
//         //     }
//         // }
//         // if (state.screenshot) {
//         //     if (gl.current) {
//         //         state.screenshot = false
//         //         let im = gl.current.domElement.toDataURL('image/png')
//         //         saveFile(im, ss_filename + '.png')
//         //     } else {
//         //         throw new Error('Missing gl')
//         //     }
//         // }
//     })

//     return [
//         bind,
//         startRecording,
//         stopRecording,
//         loadCapture,
//         screenshot,
//         setCapture,
//         { getProgress, getPlayhead, ...state },
//     ]
// }

function getExtension(format: string): string {
    if (format === 'webm' || format === 'gif') return format

    return 'tar'
}
