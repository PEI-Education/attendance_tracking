import {
  __spreadValues
} from "./chunk.LKA3TPUC.js";

// src/internal/form.ts
var formCollections = /* @__PURE__ */ new WeakMap();
var userInteractedControls = /* @__PURE__ */ new WeakMap();
var reportValidityOverloads = /* @__PURE__ */ new WeakMap();
var FormControlController = class {
  constructor(host, options) {
    (this.host = host).addController(this);
    this.options = __spreadValues({
      form: (input) => {
        if (input.hasAttribute("form") && input.getAttribute("form") !== "") {
          const root = input.getRootNode();
          const formId = input.getAttribute("form");
          if (formId) {
            return root.getElementById(formId);
          }
        }
        return input.closest("form");
      },
      name: (input) => input.name,
      value: (input) => input.value,
      defaultValue: (input) => input.defaultValue,
      disabled: (input) => {
        var _a;
        return (_a = input.disabled) != null ? _a : false;
      },
      reportValidity: (input) => typeof input.reportValidity === "function" ? input.reportValidity() : true,
      setValue: (input, value) => input.value = value
    }, options);
    this.handleFormData = this.handleFormData.bind(this);
    this.handleFormSubmit = this.handleFormSubmit.bind(this);
    this.handleFormReset = this.handleFormReset.bind(this);
    this.reportFormValidity = this.reportFormValidity.bind(this);
    this.handleUserInput = this.handleUserInput.bind(this);
  }
  hostConnected() {
    const form = this.options.form(this.host);
    if (form) {
      this.attachForm(form);
    }
    this.host.addEventListener("sl-input", this.handleUserInput);
  }
  hostDisconnected() {
    this.detachForm();
    this.host.removeEventListener("sl-input", this.handleUserInput);
  }
  hostUpdated() {
    const form = this.options.form(this.host);
    if (!form) {
      this.detachForm();
    }
    if (form && this.form !== form) {
      this.detachForm();
      this.attachForm(form);
    }
    if (this.host.hasUpdated) {
      this.setValidity(this.host.checkValidity());
    }
  }
  attachForm(form) {
    if (form) {
      this.form = form;
      if (formCollections.has(this.form)) {
        formCollections.get(this.form).add(this.host);
      } else {
        formCollections.set(this.form, /* @__PURE__ */ new Set([this.host]));
      }
      this.form.addEventListener("formdata", this.handleFormData);
      this.form.addEventListener("submit", this.handleFormSubmit);
      this.form.addEventListener("reset", this.handleFormReset);
      if (!reportValidityOverloads.has(this.form)) {
        reportValidityOverloads.set(this.form, this.form.reportValidity);
        this.form.reportValidity = () => this.reportFormValidity();
      }
    } else {
      this.form = void 0;
    }
  }
  detachForm() {
    var _a;
    if (this.form) {
      (_a = formCollections.get(this.form)) == null ? void 0 : _a.delete(this.host);
      this.form.removeEventListener("formdata", this.handleFormData);
      this.form.removeEventListener("submit", this.handleFormSubmit);
      this.form.removeEventListener("reset", this.handleFormReset);
      if (reportValidityOverloads.has(this.form)) {
        this.form.reportValidity = reportValidityOverloads.get(this.form);
        reportValidityOverloads.delete(this.form);
      }
    }
    this.form = void 0;
  }
  handleFormData(event) {
    const disabled = this.options.disabled(this.host);
    const name = this.options.name(this.host);
    const value = this.options.value(this.host);
    const isButton = this.host.tagName.toLowerCase() === "sl-button";
    if (!disabled && !isButton && typeof name === "string" && name.length > 0 && typeof value !== "undefined") {
      if (Array.isArray(value)) {
        value.forEach((val) => {
          event.formData.append(name, val.toString());
        });
      } else {
        event.formData.append(name, value.toString());
      }
    }
  }
  handleFormSubmit(event) {
    var _a;
    const disabled = this.options.disabled(this.host);
    const reportValidity = this.options.reportValidity;
    if (this.form && !this.form.noValidate) {
      (_a = formCollections.get(this.form)) == null ? void 0 : _a.forEach((control) => {
        this.setUserInteracted(control, true);
      });
    }
    if (this.form && !this.form.noValidate && !disabled && !reportValidity(this.host)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  handleFormReset() {
    this.options.setValue(this.host, this.options.defaultValue(this.host));
    this.setUserInteracted(this.host, false);
  }
  async handleUserInput() {
    await this.host.updateComplete;
    this.setUserInteracted(this.host, true);
  }
  reportFormValidity() {
    if (this.form && !this.form.noValidate) {
      const elements = this.form.querySelectorAll("*");
      for (const element of elements) {
        if (typeof element.reportValidity === "function") {
          if (!element.reportValidity()) {
            return false;
          }
        }
      }
    }
    return true;
  }
  setUserInteracted(el, hasInteracted) {
    userInteractedControls.set(el, hasInteracted);
    el.requestUpdate();
  }
  doAction(type, invoker) {
    if (this.form) {
      const button = document.createElement("button");
      button.type = type;
      button.style.position = "absolute";
      button.style.width = "0";
      button.style.height = "0";
      button.style.clipPath = "inset(50%)";
      button.style.overflow = "hidden";
      button.style.whiteSpace = "nowrap";
      if (invoker) {
        button.name = invoker.name;
        button.value = invoker.value;
        ["formaction", "formenctype", "formmethod", "formnovalidate", "formtarget"].forEach((attr) => {
          if (invoker.hasAttribute(attr)) {
            button.setAttribute(attr, invoker.getAttribute(attr));
          }
        });
      }
      this.form.append(button);
      button.click();
      button.remove();
    }
  }
  /** Resets the form, restoring all the control to their default value */
  reset(invoker) {
    this.doAction("reset", invoker);
  }
  /** Submits the form, triggering validation and form data injection. */
  submit(invoker) {
    this.doAction("submit", invoker);
  }
  /**
   * Synchronously sets the form control's validity. Call this when you know the future validity but need to update
   * the host element immediately, i.e. before Lit updates the component in the next update.
   */
  setValidity(isValid) {
    var _a;
    const host = this.host;
    const hasInteracted = Boolean(userInteractedControls.get(host));
    const required = Boolean(host.required);
    if ((_a = this.form) == null ? void 0 : _a.noValidate) {
      host.removeAttribute("data-required");
      host.removeAttribute("data-optional");
      host.removeAttribute("data-invalid");
      host.removeAttribute("data-valid");
      host.removeAttribute("data-user-invalid");
      host.removeAttribute("data-user-valid");
    } else {
      host.toggleAttribute("data-required", required);
      host.toggleAttribute("data-optional", !required);
      host.toggleAttribute("data-invalid", !isValid);
      host.toggleAttribute("data-valid", isValid);
      host.toggleAttribute("data-user-invalid", !isValid && hasInteracted);
      host.toggleAttribute("data-user-valid", isValid && hasInteracted);
    }
  }
  /**
   * Updates the form control's validity based on the current value of `host.checkValidity()`. Call this when anything
   * that affects constraint validation changes so the component receives the correct validity states.
   */
  updateValidity() {
    const host = this.host;
    this.setValidity(host.checkValidity());
  }
};

export {
  formCollections,
  FormControlController
};
