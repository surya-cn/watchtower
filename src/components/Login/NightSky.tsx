import React, { useEffect, useState } from 'react';
import styles from './NightSky.module.css';

export default function NightSky() {
  const [stars, setStars] = useState<{ x: number, y: number, size: number, delay: number }[]>([]);

  useEffect(() => {
    // Generate stars on client to avoid hydration mismatch, using Math.random for natural distribution
    const generatedStars = Array.from({ length: 200 }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.5 + 0.5,
      delay: Math.random() * 5
    }));
    setStars(generatedStars);
  }, []);

  return (
    <div className={styles.nightSky}>
      {stars.map((star, i) => (
        <div 
          key={i} 
          className={styles.star} 
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
