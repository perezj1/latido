param([ValidateSet('inspeccionar','aplicar')][string]$Accion='inspeccionar')
$ErrorActionPreference='Stop'
if($env:LATIDO_SUIZAMENTE_MANAGEMENT_TOKEN){node "$PSScriptRoot/suizamente-production.mjs" $Accion;exit $LASTEXITCODE}
if(-not ('SuizamenteCliCredential' -as [type])){
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class SuizamenteCliCredential {
 [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool Read(string target,int type,int flags,out IntPtr credential);
 [DllImport("advapi32.dll",EntryPoint="CredFree")] public static extern void Free(IntPtr credential);
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct Credential {public int Flags;public int Type;public string Target;public string Comment;public long Written;public int Size;public IntPtr Blob;public int Persist;public int Attributes;public IntPtr Attribute;public string Alias;public string User;}
}
'@
}
$credentialPointer=[IntPtr]::Zero
if(-not [SuizamenteCliCredential]::Read('Supabase CLI:access-token',1,0,[ref]$credentialPointer)){throw 'Inicia sesion con supabase login antes de continuar'}
try{
 $credential=[Runtime.InteropServices.Marshal]::PtrToStructure($credentialPointer,[type][SuizamenteCliCredential+Credential])
 $credentialBytes=New-Object byte[] $credential.Size
 [Runtime.InteropServices.Marshal]::Copy($credential.Blob,$credentialBytes,0,$credentialBytes.Length)
 $env:LATIDO_SUIZAMENTE_MANAGEMENT_TOKEN=[Text.Encoding]::UTF8.GetString($credentialBytes)
 node "$PSScriptRoot/suizamente-production.mjs" $Accion
 if($LASTEXITCODE -ne 0){throw 'La comprobacion de Suizamente no ha terminado correctamente'}
}finally{
 Remove-Item Env:LATIDO_SUIZAMENTE_MANAGEMENT_TOKEN -ErrorAction SilentlyContinue
 [SuizamenteCliCredential]::Free($credentialPointer)
}
