/**
 * 音素相似度比较工具
 * 用于判断两个单词发音是否相似
 */

/**
 * 简化版Soundex算法 - 将单词转换为音素编码
 * 发音相似的单词会产生相同或相近的编码
 */
function soundex(word: string): string {
    const s = word.toUpperCase().replace(/[^A-Z]/g, '');
    if (s.length === 0) return '';

    const firstLetter = s[0];
    const codes: { [key: string]: string } = {
        'BFPV': '1',
        'CGJKQSXZ': '2',
        'DT': '3',
        'L': '4',
        'MN': '5',
        'R': '6'
    };

    let code = firstLetter;
    let prevCode = '';

    for (let i = 1; i < s.length; i++) {
        let char = s[i];
        let charCode = '';

        for (const [chars, num] of Object.entries(codes)) {
            if (chars.includes(char)) {
                charCode = num;
                break;
            }
        }

        if (charCode && charCode !== prevCode) {
            code += charCode;
            prevCode = charCode;
        }
    }

    return (code + '0000').substring(0, 4);
}

/**
 * 计算两个字符串的编辑距离（Levenshtein Distance）
 */
function levenshteinDistance(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[len1][len2];
}

/**
 * 判断两个单词是否发音相似
 * @param word1 单词1
 * @param word2 单词2
 * @param threshold 相似度阈值 (0-1)，默认0.7
 * @returns 是否相似
 */
/**
 * 提取单词的辅音骨架（忽略元音）
 * 用于各元音发音差异大的情况
 */
function getConsonantSkeleton(word: string): string {
    // 保留首字母，即使是元音
    const first = word.charAt(0);
    const rest = word.slice(1).replace(/[aeiouy]/gi, '');
    return (first + rest).toLowerCase();
}

/**
 * 判断两个单词是否发音相似 (增强版)
 * @param word1 单词1
 * @param word2 单词2
 * @param threshold 相似度阈值 (0-1)，降级默认值为0.6以提高容错
 * @returns 是否相似
 */
export function arePhoneticallySimila(word1: string, word2: string, threshold: number = 0.6): boolean {
    const w1 = word1.toLowerCase();
    const w2 = word2.toLowerCase();

    // 1. 完全匹配
    if (w1 === w2) {
        return true;
    }

    // 2. 辅音骨架匹配 (解决 letter / little 这种元音差异)
    // 只有当单词长度大于3时才使用，避免短词误判
    if (w1.length > 3 && w2.length > 3) {
        const sk1 = getConsonantSkeleton(w1);
        const sk2 = getConsonantSkeleton(w2);
        if (sk1 === sk2) {
            // 再次确认长度差异不能太大
            if (Math.abs(w1.length - w2.length) <= 2) {
                return true;
            }
        }
    }

    // 3. Soundex音素编码匹配
    const sound1 = soundex(word1);
    const sound2 = soundex(word2);
    if (sound1 === sound2 && sound1 !== '') {
        return true;
    }

    // 4. 编辑距离相似度
    const maxLen = Math.max(word1.length, word2.length);
    const distance = levenshteinDistance(w1, w2);
    const similarity = 1 - (distance / maxLen);

    return similarity >= threshold;
}

/**
 * 在识别结果中查找与目标单词最匹配的单词
 * @param targetWord 目标单词
 * @param recognizedWords 识别出的单词列表
 * @param threshold 匹配阈值
 * @returns 匹配的单词，如果没有则返回null
 */
export function findPhoneticMatch(targetWord: string, recognizedWords: string[], threshold: number = 0.7): string | null {
    for (const word of recognizedWords) {
        if (arePhoneticallySimila(targetWord, word, threshold)) {
            return word;
        }
    }
    return null;
}
