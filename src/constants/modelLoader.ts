import { ModelCost } from '@type/chat';
import { loadModels } from '@utils/modelReader';

let modelOptions: string[] = [];
let modelCost: ModelCost = {};
let modelTypes: { [key: string]: string } = {};
let modelStreamSupport: { [key: string]: boolean } = {};
let modelDisplayNames: { [key: string]: string } = {};

export const initializeModels = async () => {
  const models = await loadModels();
  modelOptions = models.modelOptions;
  modelCost = models.modelCost;
  modelTypes = models.modelTypes;
  modelStreamSupport = models.modelStreamSupport;
  modelDisplayNames = models.modelDisplayNames;
};

initializeModels();

export { modelOptions, modelCost, modelTypes, modelStreamSupport, modelDisplayNames };
