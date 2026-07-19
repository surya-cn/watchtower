"use client";

import { useState } from "react";
import styles from "./Login.module.css";
import NightSky from "@/components/Login/NightSky";
import Lighthouse from "@/components/Login/Lighthouse";
import LighthouseBeam from "@/components/Login/LighthouseBeam";
import LoginCard from "@/components/Login/LoginCard";

export default function LoginPage() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className={styles.container}>
      <NightSky />
      
      {/* Lighthouse Structure and Animation */}
      <Lighthouse />
      <LighthouseBeam isHovered={isHovered} />
      
      {/* Interactive Login Card */}
      <LoginCard 
        isHovered={isHovered} 
        onHoverStart={() => setIsHovered(true)} 
        onHoverEnd={() => setIsHovered(false)} 
      />
    </div>
  );
}
