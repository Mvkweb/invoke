import { appConfig } from '../config/appConfig';

export class ProviderManager {
    private geminiModels: Set<string>;

    constructor() {
        this.geminiModels = new Set([
            "gemini-1.5-pro-latest", "gemini-1.5-pro-preview-0514",
            "gemini-1.5-flash-latest", "gemini-1.5-flash-preview-0514",
            "gemini-pro",
        ]);
        this.geminiModels.add(appConfig.bigModel);
        this.geminiModels.add(appConfig.smallModel);
    }

    getAvailableModels(): string[] {
        // This should eventually list models from all integrated providers
        return Array.from(this.geminiModels).sort();
    }

    private cleanModelName(model: string): string {
        return model.replace(/^(gemini|anthropic|openai)\//, '');
    }

    private mapModelAlias(cleanModel: string): string {
        const modelLower = cleanModel.toLowerCase();
        if (modelLower.includes('haiku')) return appConfig.smallModel;
        if (modelLower.includes('sonnet') || modelLower.includes('opus')) return appConfig.bigModel;
        return cleanModel;
    }

    validateAndMapModel(originalModel: string): { mappedModel: string; wasMapped: boolean } {
        const cleanModel = this.cleanModelName(originalModel);
        const mapped = this.mapModelAlias(cleanModel);
        
        if (mapped !== cleanModel) {
            return { mappedModel: mapped, wasMapped: true };
        }
        if (this.geminiModels.has(cleanModel)) {
            return { mappedModel: cleanModel, wasMapped: false };
        }
        return { mappedModel: cleanModel, wasMapped: false }; // Pass through unknown models
    }
}

export const providerManager = new ProviderManager();