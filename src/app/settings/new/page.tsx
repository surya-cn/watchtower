import ConfigForm from "@/components/config/ConfigForm";
import styles from "../Settings.module.css";
import BlurText from "@/components/BlurText/BlurText";

export default function NewProjectPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        <BlurText text="Create New Project" delay={30} animateBy="words" direction="top" />
      </h1>
      <ConfigForm />
    </div>
  );
}
