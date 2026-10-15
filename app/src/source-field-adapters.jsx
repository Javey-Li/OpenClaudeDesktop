import React, { createContext, useContext, useId, useMemo } from 'react';
import { _y as Field, vy as Label, yy as Description, by as ErrorText, Bh as TextInput, $v as TextArea } from './generated/chat/shared-frame-C_2npUJq.js';

// Only the Base UI provider/native-control boundary lives here. The original
// Field, Label, Description, Error and TextField own all markup and styling.
const FieldContext = createContext(null);
const joinIds = (...values) => [...new Set(values.filter(Boolean).flatMap(value => value.split(/\s+/)))].join(' ') || undefined;

const fieldPartsRegistry = Object.fromEntries(Object.entries({ Field, Label, Description, ErrorText, TextInput, TextArea }).map(([key, value]) => [key, new Set([value])]));
export function registerNativeFieldComponents(components) {
  for (const [key, component] of Object.entries(components)) fieldPartsRegistry[key]?.add(component);
}

// Source fields compose their labels/hints as direct children or DOM wrappers.
// Resolve those before rendering, so aria relationships work on the first render
// (including SSR), without a registration effect or an extra empty render.
function fieldParts(children, parts = {}) {
  React.Children.forEach(children, child => {
    if (!React.isValidElement(child) || fieldPartsRegistry.Field.has(child.type)) return;
    if (fieldPartsRegistry.Label.has(child.type)) parts.label = child;
    else if (fieldPartsRegistry.Description.has(child.type)) parts.description = child;
    else if (fieldPartsRegistry.ErrorText.has(child.type)) parts.error = child;
    else if (fieldPartsRegistry.TextInput.has(child.type) || fieldPartsRegistry.TextArea.has(child.type)) parts.control = child;
    else if (typeof child.type === 'string' || child.type === React.Fragment) fieldParts(child.props.children, parts);
  });
  return parts;
}

export function NativeFieldRoot({ children, render, invalid = false, disabled = false, validationMode, ...props }) {
  const id = useId();
  const parts = fieldParts(children);
  const labelId = parts.label ? parts.label.props.id ?? `${id}-label` : undefined;
  const hintId = parts.description ? parts.description.props.id ?? `${id}-hint` : undefined;
  const errorId = invalid && parts.error ? parts.error.props.id ?? `${id}-error` : undefined;
  const controlId = parts.control?.props.id ?? parts.label?.props.htmlFor ?? `${id}-control`;
  const context = useMemo(() => ({ controlId, labelId, hintId, errorId, invalid, disabled }), [controlId, labelId, hintId, errorId, invalid, disabled]);
  const state = { disabled, valid: invalid ? false : null };
  const rootProps = { ...props, children, 'data-invalid': invalid || undefined, 'data-disabled': disabled || undefined };
  return <FieldContext.Provider value={context}>{render(rootProps, state)}</FieldContext.Provider>;
}

export function NativeFieldLabel(props) {
  const field = useContext(FieldContext);
  return <label htmlFor={field?.controlId} id={field?.labelId} {...props} />;
}

export function NativeFieldDescription(props) {
  const field = useContext(FieldContext);
  return <div id={field?.hintId} {...props} />;
}

export function NativeFieldError({ render, match, ...props }) {
  const field = useContext(FieldContext);
  if (!field?.invalid && match !== true) return null;
  return render({ id: field?.errorId, role: 'alert', ...props });
}

export function useNativeFieldControlProps(props = {}) {
  const field = useContext(FieldContext);
  if (!field) return props;
  return {
    ...props,
    id: props.id ?? field.controlId,
    'aria-labelledby': props['aria-labelledby'] ?? (props['aria-label'] ? undefined : field.labelId),
    'aria-describedby': joinIds(props['aria-describedby'], field.hintId, field.errorId),
    'aria-invalid': props['aria-invalid'] ?? (field.invalid || undefined),
    disabled: props.disabled || field.disabled || undefined,
  };
}

export function NativeFieldControl({ render, ref, ...fieldProps }) {
  const props = useNativeFieldControlProps({ ...render.props, ...fieldProps });
  return React.cloneElement(render, { ...props, ...(ref ? { ref } : {}) });
}

export const useNativeFieldMetadata = () => useContext(FieldContext) ?? {};
