const ExportResultCode = {
  SUCCESS: 0,
  FAILED: 1,
};

class NodeSDK {
  constructor(options = {}) {
    this._exporter = options.traceExporter ?? null;
    this._instrumentations = Array.isArray(options.instrumentations)
      ? options.instrumentations
      : options.instrumentations
        ? [options.instrumentations]
        : [];
    this._enabled = false;
  }

  async start() {
    if (this._enabled) {
      return;
    }
    for (const instrumentation of this._instrumentations) {
      if (typeof instrumentation.enable === "function") {
        instrumentation.enable({ exporter: this._exporter });
      }
    }
    this._enabled = true;
  }

  async shutdown() {
    if (!this._enabled) {
      return;
    }
    for (const instrumentation of this._instrumentations) {
      if (typeof instrumentation.disable === "function") {
        instrumentation.disable();
      }
    }
    this._enabled = false;
  }
}

export { NodeSDK, ExportResultCode };
