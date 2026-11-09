// プロフィール編集ページ（要件 T-09 / T-11 / 6.7）。
// 編集できるのはタレントとして見ているときだけ。ほかのロールでは案内文だけを出し、フォームは出さない。
import { TALENTS, DEMO_TALENT_ID } from '../data/talents.js';
import { SKILL_TAGS } from '../data/master.js';
import { getRole, getProfile, saveProfile } from '../lib/storage.js';
import { validateProfile, countChars, PROFILE_BIO_MAX_LENGTH } from '../lib/validation.js';
import { getEditAccess, toProfileFormValues, buildProfileUpdate } from '../lib/profile-form.js';
import { ROLE_CHANGE_EVENT } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { setupVideoUploader } from '../components/video-uploader.js';

const SAVED_MESSAGE = 'プロフィールを保存しました';
const SAVE_ERROR_MESSAGE = 'プロフィールを保存できませんでした。ブラウザの保存領域がいっぱいか、無効になっている可能性があります';

const gate = document.querySelector('[data-profile-gate]');
const content = document.querySelector('[data-profile-content]');
const form = document.querySelector('[data-profile-form]');

let initialized = false;

function setError(name, message) {
  const error = form.querySelector(`[data-field-error="${name}"]`);
  const field = form.querySelector(`[data-field="${name}"]`);
  if (error) {
    error.textContent = message ?? '';
    error.hidden = !message;
  }
  field?.setAttribute('aria-invalid', String(Boolean(message)));
}

function renderSkillOptions(container, selected) {
  const chips = SKILL_TAGS.map((skill) => {
    const label = document.createElement('label');
    label.className = 'chip chip--selectable';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'chip__input';
    input.name = 'skills';
    input.value = skill;
    input.checked = selected.includes(skill);
    label.append(input, skill);
    return label;
  });
  container.replaceChildren(...chips);
}

function setupProfileForm() {
  const bio = form.querySelector('[data-field="bio"]');
  const bioCount = form.querySelector('[data-bio-count]');
  const skillOptions = form.querySelector('[data-skill-options]');
  if (!(bio instanceof HTMLTextAreaElement) || !bioCount || !skillOptions) {
    throw new Error('プロフィール編集フォームの要素が見つかりません');
  }
  const values = toProfileFormValues(TALENTS, getProfile());
  bio.value = values.bio;
  renderSkillOptions(skillOptions, values.skills);

  const updateCount = () => {
    const length = countChars(bio.value.trim());
    // 上限超えは色だけでなく文言でも伝える
    bioCount.textContent = `${length} / ${PROFILE_BIO_MAX_LENGTH}文字${length > PROFILE_BIO_MAX_LENGTH ? '（上限を超えています）' : ''}`;
  };
  bio.addEventListener('input', () => {
    updateCount();
    setError('bio', '');
  });
  updateCount();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = {
      bio: bio.value,
      skills: [...form.querySelectorAll('input[name="skills"]:checked')].map((item) => item.value),
    };
    const { valid, errors } = validateProfile(input);
    setError('bio', errors.bio);
    setError('skills', errors.skills);
    if (!valid) {
      bio.focus();
      return;
    }
    const saved = saveProfile(buildProfileUpdate(getProfile(), input));
    showToast(saved ? SAVED_MESSAGE : SAVE_ERROR_MESSAGE, { type: saved ? 'success' : 'error' });
  });
}

/** ロール切替はページを再読み込みしないので、そのたびに出し分ける。フォームの準備は最初に編集できたときだけ */
function applyAccess(role) {
  const access = getEditAccess(role);
  gate.textContent = access.message;
  gate.hidden = access.canEdit;
  content.hidden = !access.canEdit;
  if (!access.canEdit || initialized) return;
  initialized = true;
  setupProfileForm();
  setupVideoUploader(document.querySelector('[data-video-uploader]'), { talentId: DEMO_TALENT_ID }).catch((error) => {
    console.error('自己紹介動画の欄を準備できませんでした', error);
  });
}

function init() {
  if (!(gate instanceof HTMLElement) || !(content instanceof HTMLElement) || !(form instanceof HTMLFormElement)) {
    console.error('profile-edit.js: 描画先が見つかりません');
    return;
  }
  try {
    applyAccess(getRole());
    document.addEventListener(ROLE_CHANGE_EVENT, (event) => {
      try {
        applyAccess(event.detail?.role ?? getRole());
      } catch (error) {
        console.error('プロフィール編集の表示を切り替えられませんでした', error);
      }
    });
  } catch (error) {
    console.error('プロフィール編集ページの準備に失敗しました', error);
  }
}

init();
