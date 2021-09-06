// Original Author: GitHub user gsimone
// Original URL: https://github.com/gsimone/use-capture/commit/c3cc4934ae2d48fa6b9da6aed509158d280b731d
// Licence: MIT
// Adapted by: Jesse haviland

import * as THREE from 'three'
import * as React from 'react'
import { useRef, useCallback, useMemo, useEffect, useState } from 'react'
import { SharedCanvasContext } from 'react-three-fiber'

type RecorderContext = [
    (context: SharedCanvasContext) => void,
    () => void,
    () => void,
    (framerate: number, format: string, filename: string) => void,
    (filename: string) => void,
    {
        playhead: number
        duration: number
        getProgress: () => number
        getPlayhead: () => number
    }
]

type RecorderProps = {
    format: 'webm' | 'gif' | 'jpeg'
    duration: number
    framerate: number
    fps: number
    verbose: boolean
    motionBlurFrames: number
    children: React.ReactNode
    showWidget: boolean
    filename: string
}

const state = {
    shouldRecord: false,
    prevPlayhead: 0,
    isRecording: false,
    playhead: 0,
    duration: 0,
    screenshot: false,
}

// Future CCapture Import
let cc = null

// Future CCapture Import for tars (png, jpeg)
let cct = null

let capturer = null
let ext = null
let fname = null
let ss_filename = null

const startRecording = () => {
    state.playhead = 0
    state.isRecording = true
    capturer.start()
}

const stopRecording = () => {
    state.shouldRecord = false
    state.isRecording = false
    capturer.stop()
    capturer.save((blob: Blob) => {
        const fileURL = window.URL.createObjectURL(blob)
        const tempLink = document.createElement('a')
        tempLink.href = fileURL
        tempLink.setAttribute('download', `${fname}.${getExtension(ext)}`)
        tempLink.click()
    })
}

const getProgress = () => {
    return state.playhead / state.duration
}

const getPlayhead = () => {
    return state.playhead
}

const loadCapture = (framerate, format, filename) => {
    ext = format
    fname = filename
    // console.log(format)

    if (format === 'webm' || format === 'gif') {
        capturer = new cc({
            format,
            framerate,
            verbose: false,
            motionBlurFrames: false,
            display: false,
            quality: 100,
            workersPath: './',
        })
    } else {
        capturer = new cct({
            format,
            framerate,
            verbose: false,
            motionBlurFrames: false,
            display: false,
            quality: 100,
            workersPath: './',
        })
    }
}

const screenshot = (filename) => {
    ss_filename = filename
    state.screenshot = true
}

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

export function useCapture(): RecorderContext {
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

    const [clock] = useState(new THREE.Clock())
    const gl = useRef<THREE.WebGLRenderer>()

    const bind = useCallback((context: SharedCanvasContext) => {
        gl.current = context.gl
    }, [])

    const loop = useCallback(() => {
        if (state.isRecording) {
            if (gl.current) {
                capturer.capture(gl.current.domElement)
            } else {
                throw new Error('Missing gl')
            }
        }

        if (state.screenshot) {
            if (gl.current) {
                state.screenshot = false
                let im = gl.current.domElement.toDataURL('image/png')
                saveFile(im, ss_filename + '.png')
            } else {
                throw new Error('Missing gl')
            }
        }

        requestAnimationFrame(loop)
    }, [])

    useEffect(() => {
        requestAnimationFrame(loop)
    }, [loop])

    return [
        bind,
        startRecording,
        stopRecording,
        loadCapture,
        screenshot,
        { getProgress, getPlayhead, ...state },
    ]
}

function getExtension(format: string): string {
    if (format === 'webm' || format === 'gif') return format

    return 'tar'
}
