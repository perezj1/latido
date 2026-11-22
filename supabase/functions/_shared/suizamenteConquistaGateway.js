import {createSuizamenteConquistaHttp} from './suizamenteConquistaHttp.js'
import {createSuizamenteSocialHttp} from './suizamenteSocialHttp.js'
import {createSuizamenteHttp,suizamenteAllowedOrigin} from './suizamenteHttp.js'

// Only this known development branch is added. Existing production functions
// and their origin lists remain unchanged.
export const CONQUISTA_PREVIEW_ORIGIN='https://suizamente-git-suizamente-social-joses-projects-58c1a8e4.vercel.app'
export const conquistaAllowedOrigin=origin=>suizamenteAllowedOrigin(origin)||origin===CONQUISTA_PREVIEW_ORIGIN
export function createSuizamenteConquistaGateway({getClient,getSecret,questions,allowedOrigin=conquistaAllowedOrigin}){
 const conquest=createSuizamenteConquistaHttp({getClient,allowedOrigin})
 const social=createSuizamenteSocialHttp({getClient,getSecret,allowedOrigin})
 const votes=createSuizamenteHttp({getClient,getSecret,questions,allowedOrigin})
 return request=>{
  const url=new URL(request.url),path=url.pathname.replace(/^.*\/suizamente-conquista/,'')
  if(/^\/social(?:\/|$)/.test(path)){
   url.pathname='/functions/v1/suizamente-social'+path.slice('/social'.length)
   return social({...request,url:url.href})
  }
  if(/^\/base(?:\/|$)/.test(path)){
   url.pathname='/functions/v1/suizamente-votos'+path.slice('/base'.length)
   return votes({...request,url:url.href})
  }
  return conquest(request)
 }
}
