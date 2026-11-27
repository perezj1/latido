// No improvement module is imported until an enabled route or arrival opens it.
const loaders={MejorasMinuto:()=>import('./MejorasMinuto'),MejorasEspejo:()=>import('./MejorasEspejo'),MejorasMisterio:()=>import('./MejorasMisterio'),MejorasDecorar:()=>import('./MejorasDecorar'),MejorasAvisos:()=>import('./MejorasAvisos')},modules=new Map()
export function loadImprovement(group){if(!modules.has(group))modules.set(group,loaders[group]().catch(e=>{modules.delete(group);throw e}));return modules.get(group)}
