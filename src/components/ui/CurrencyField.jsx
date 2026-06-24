import React from 'react';
import FormRow from './FormRow';
import { CurrencyInput } from './PlainInputs';

export default function CurrencyField({
  label,
  htmlFor,
  error,
  helperText,
  style,
  containerClassName,
  ...props
}) {
  return (
    <FormRow
      label={label}
      htmlFor={htmlFor}
      error={error}
      helperText={helperText}
      style={style}
      className={containerClassName}
    >
      <CurrencyInput
        id={htmlFor}
        {...props}
      />
    </FormRow>
  );
}
