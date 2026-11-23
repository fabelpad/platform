import { READING_LEVELS, type ReadingLevel } from './readingLevel';
import { automaticReadingLevel, effectiveReadingLevel, isValidBirthDate } from './profileReading';
import './profile-reading.css';

type Props = { id: string; birthDate: string; onBirthDateChange: (value: string) => void; required?: boolean; today: string; readingLevelOverride?: ReadingLevel; onOverrideChange: (value: ReadingLevel | undefined) => void; legacyLevel?: unknown; showReadingLevel?: boolean };
export default function ProfileReadingFields({ id, birthDate, onBirthDateChange, required, today, readingLevelOverride, onOverrideChange, legacyLevel, showReadingLevel = true }: Props) {
  const automatic = automaticReadingLevel(birthDate, today);
  const effective = effectiveReadingLevel({ birthDate }, legacyLevel, today);
  const label = (level: ReadingLevel) => READING_LEVELS.find(item => item.id === level)!.label;
  return <div className="profile-reading-fields">
    <label htmlFor={`${id}-birth-date`}>{!birthDate && !required ? 'Geboortedatum toevoegen' : 'Geboortedatum'}</label>
    <input id={`${id}-birth-date`} name="birthDate" type="date" lang="nl-NL" autoComplete="bday" value={birthDate} max={today} required={required} onChange={event => onBirthDateChange(event.target.value)} aria-describedby={`${id}-birth-hint`} />
    <small id={`${id}-birth-hint`}>We gebruiken de geboortedatum om het leesniveau te kiezen. Dag, maand, jaar.</small>
    {isValidBirthDate(birthDate, today) && <small className="profile-birth-date-display">Geboortedatum: {birthDate.split('-').reverse().join('-')}</small>}
    {showReadingLevel && <><label htmlFor={`${id}-reading-level`}>Leesniveau</label>
      <select id={`${id}-reading-level`} value={readingLevelOverride ?? 'auto'} onChange={event => onOverrideChange(event.target.value === 'auto' ? undefined : event.target.value as ReadingLevel)}>
        <option value="auto">Automatisch · {label(automatic ?? effective)}</option>
        {READING_LEVELS.map(level => <option key={level.id} value={level.id}>Handmatig · {level.label}</option>)}
      </select>
      <small role="status">{readingLevelOverride ? `Handmatig · ${label(readingLevelOverride)}. ${automatic ? `Automatisch advies: ${label(automatic)}.` : 'Voeg de geboortedatum toe voor een automatisch advies.'}` : automatic ? `Automatisch · ${label(automatic)}. Dit verandert mee op de verjaardag.` : `Voeg de geboortedatum toe. Tot die tijd blijft ${label(effective)} actief.`}</small>
      {readingLevelOverride && <button className="profile-reading-auto" type="button" onClick={() => onOverrideChange(undefined)}>Gebruik automatisch leesniveau</button>}
    </>}
  </div>;
}
