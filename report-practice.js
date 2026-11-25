/* Report follow-ups use the current prompt and the same verifier as the teacher's editor. */
(() => {
  'use strict';
  function questions(year, subject, question) {
    if (subject !== '數學' || !['中一','中二'].includes(year) ||
        !['number','text'].includes(question.kind) || question.diagram || question.figure ||
        question.source?.type === 'adapted' || question.sourceNotice) return [];
    const engine = globalThis.EduEquationPractice;
    const course = year === '中一' ? 'equations' : 'percent';
    try {
      const check = course === 'equations' ? globalThis.EduEquationCheck : globalThis.EduPercentCheck;
      if (question.kind === 'number') {
        const expected = engine.inspect(question.prompt, course).expected;
        if (!Number.isFinite(question.expected) || Math.abs(expected-question.expected) > 1e-9*Math.max(1,Math.abs(expected))) return [];
        if (check.check(question)?.status !== 'match') return [];
      } else if (question.referenceAnswer && check.check(question)?.status === 'mismatch') {
        return [];
      }
      return engine.generate(question.prompt, null, course).questions;
    } catch {
      return [];
    }
  }
  globalThis.EduReportPractice = {questions};
})();
