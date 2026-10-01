import type {
  ChangeEvent,
  HTMLAttributes,
  HTMLInputTypeAttribute,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import type {
  Control,
  FieldError,
  FieldValues,
  Path,
  UseControllerProps,
} from "react-hook-form";

export type SelectOption = {
  label: string;
  value: string | number;
  disabled?: boolean;
};

/** Allowed input sanitization patterns. */
export type FormInputRegexType =
  | "specialChar"
  | "dotChar"
  | "addressChar"
  | "alphaNumeric"
  | "character"
  | "space"
  | "restrictNumberAndSymbols"
  | "numberWithoutExpo"
  | "number";

type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "onBlur" | "value" | "name" | "ref"
>;

export type FormInputProps<T extends FieldValues = FieldValues> = Omit<
  UseControllerProps<T>,
  "render" | "control"
> &
  InputProps & {
    control: Control<T>;
    type?: HTMLInputTypeAttribute;
    label?: string;
    placeholder?: string;
    isRequired?: boolean;
    showErrorMessage?: boolean;
    isEyeIconRequired?: boolean;
    isDisabled?: boolean;
    maxLength?: number;
    regexType?: FormInputRegexType;
    onCustomChange?: (e?: ChangeEvent<HTMLInputElement>) => void;
    id?: string;
    formatAsCommaSeparated?: boolean;
    numberLocale?: string;
  };

export type CheckboxOption = {
  id: string;
  label: string;
  disabled?: boolean;
};

export type BaseFormControlProps<T extends FieldValues> = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "type" | "name"
> & {
  name: Path<T>;
  control: Control<T>;
  label?: string;
  labelDescription?: string;
  helperText?: string;
  error?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  showErrorMessage?: boolean;
  labelClassName?: string;
  checkboxClassName?: string;
};

export type FormCheckboxProps<T extends FieldValues> =
  BaseFormControlProps<T> & {
    onChange?: (checked: boolean, name: Path<T>) => void;
  };

export type FormCheckboxGroupProps<T extends FieldValues> =
  BaseFormControlProps<T> & {
    checkBoxOptions: ReadonlyArray<CheckboxOption>;
    label: string;
    onChange?: (checked: boolean, name: Path<T>) => void;
  };

export type RadioOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

export type FormRadioGroupProps<T extends FieldValues = FieldValues> = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange"
> & {
  name: Path<T>;
  control: Control<T>;
  radioGroupList: RadioOption[];
  label?: string;
  helperText?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  isErrorMessageVisible?: boolean;
  direction?: "horizontal" | "vertical";
  id?: string;
};

export type FormTextAreaProps<T extends FieldValues = FieldValues> = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className" | "onChange" | "value"
> & {
  name: Path<T>;
  control: Control<T>;
  label?: string;
  placeholder?: string;
  isRequired?: boolean;
  showErrorMessage?: boolean;
  isDisabled?: boolean;
  className?: string;
  id?: string;
  maxLength?: number;
  regexType?: FormInputRegexType;
  onCustomChange?: (e?: ChangeEvent<HTMLTextAreaElement>) => void;
};

export type FormDatePickerProps<T extends FieldValues> = {
  name: Path<T>;
  control: Control<T>;
  label: string;
  placeholder?: string;
  isRequired?: boolean;
  showErrorMessage?: boolean;
  isDisabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  description?: string;
  error?: FieldError;
  id?: string;
};

export type MultiSelectOption = {
  value: string | number;
  label: string;
  [key: string]: string | number;
};

export type MultiSelectGenericProps = {
  value: (string | number)[];
  onChange: (value: (string | number)[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  maxCount?: number;
  variant?: "default" | "secondary" | "destructive" | "inverted";
  searchPlaceholder?: string;
  filterFn?: (option: MultiSelectOption, search: string) => boolean;
  disabled?: boolean;
};

export type FormSelectProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  options: SelectOption[];
  placeholder?: string;
  showErrorMessage?: boolean;
  isDisabled?: boolean;
  label?: string;
  isRequired?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  className?: string;
  value?: string | number;
  onChange?: (value: string | number) => void;
  popverClassName?: string;
  inputId?: string;
};
