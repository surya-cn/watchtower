import React from 'react';
import styles from './Lighthouse.module.css';

export default function Lighthouse() {
  return (
    <div className={styles.lighthouseWrapper}>
      <img src="/lighthouse.png" alt="Lighthouse" className={styles.lighthouseImg} />
    </div>
  );
}
