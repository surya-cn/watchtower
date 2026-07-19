import React from 'react';
import styles from './Ocean.module.css';

export default function Ocean() {
  return (
    <div className={styles.oceanContainer}>
      <div className={styles.waterBase} />
      <div className={styles.waveLayer1} />
      <div className={styles.waveLayer2} />
    </div>
  );
}
