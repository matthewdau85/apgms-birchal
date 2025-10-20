import { MoonStar, SunMedium, MonitorCog } from 'lucide-react';
import styles from './ThemeToggle.module.css';
import { useTheme } from '../../styles/ThemeProvider';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: SunMedium },
  { value: 'dark', label: 'Dark', Icon: MoonStar },
  { value: 'system', label: 'System', Icon: MonitorCog }
] as const;

export const ThemeToggle = () => {
  const { mode, setMode, resolvedMode } = useTheme();

  return (
    <fieldset className={styles.toggle}>
      <legend className={styles.legend}>Theme</legend>
      <div className={styles.options} role="radiogroup" aria-label="Theme selection">
        {OPTIONS.map(({ value, label, Icon }) => (
          <label key={value} className={styles.option}>
            <input
              type="radio"
              name="theme"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            <span className={styles.icon} aria-hidden>
              <Icon size={16} />
            </span>
            <span>{label}</span>
            {value === 'system' && <span className={styles.badge}>{resolvedMode} mode</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
};
