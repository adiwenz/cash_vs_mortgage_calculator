import React from 'react';
import FormRow from './FormRow';
import { PercentInput } from './PlainInputs';

export default function PercentField({
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
      <PercentInput
        id={htmlFor}
        {...props}
      />
    </FormRow>
  );
}
