import * as React from 'react'
import styles from './styles.module.css'

import Swift from './components/Swift'

export default Swift

interface Props {
    text: string
}

export const ExampleComponent = ({ text }: Props) => {
    return <div className={styles.test}>Example Componentssss: {text}</div>
}
