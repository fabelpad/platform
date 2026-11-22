import { Compass, Heart, Leaf, Moon, Music2, Sparkles } from 'lucide-react';
import type { StoryChoice } from './storyTypes';
import './illustrated-choice.css';

type Props = {
  image: string;
  imageAlt: string;
  choices: StoryChoice[];
  reducedMotion: boolean;
  onChoose: (index: number) => void;
};

const choiceIcons = {
  compass: Compass,
  heart: Heart,
  leaf: Leaf,
  moon: Moon,
  music: Music2,
  sparkles: Sparkles,
};

export default function IllustratedChoiceScene({ image, imageAlt, choices, reducedMotion, onChoose }: Props) {
  return (
    <div className={`illustrated-choice${reducedMotion ? ' illustrated-choice-calm' : ''}`}>
      <img className="illustrated-choice-art" src={image} alt={imageAlt} loading="lazy" decoding="async" />
      <div className="illustrated-choice-options">
        {choices.map(({ label, hint, icon }, index) => {
          const Icon = choiceIcons[icon];
          return (
            <button key={index} type="button" className="illustrated-choice-option" onClick={() => onChoose(index)}>
              <span className="illustrated-choice-emblem" aria-hidden="true"><Icon strokeWidth={2.2} /></span>
              <strong>{label}</strong>
              {hint && <span className="illustrated-choice-hint">{hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
