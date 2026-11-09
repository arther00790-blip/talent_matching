// 架空データを入れ子まで凍結する。
// 画面側で配列を sort したり要素を書き換えたりすると、別のページ部品が参照している元データまで変わってしまうため。

/**
 * @template T
 * @param {T} value
 * @returns {Readonly<T>}
 */
export function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
