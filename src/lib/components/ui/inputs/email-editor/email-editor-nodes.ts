/**
 * The blocks of the email editor, besides text: buttons, images, sections, columns, spacers and
 * dividers, plus the extensions the editor needs for them. Each lives in `nodes/`; their attributes
 * are what `#lib/mail/document.ts` renders into the email.
 */
export { BlockMargins } from './nodes/block-margins';
export { EmailButton } from './nodes/button';
export { EmailColumn } from './nodes/column';
export { EmailColumns } from './nodes/columns';
export { EmailDivider } from './nodes/divider';
export { DropIntoEmpty } from './nodes/drop-into-empty';
export { EmailImage } from './nodes/image';
export { EmailSection } from './nodes/section';
export { EmailSpacer } from './nodes/spacer';
export { VariableHighlight } from './nodes/variable-highlight';
