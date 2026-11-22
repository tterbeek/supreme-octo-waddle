package app.movenotes.android.dev;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.ext.SdkExtensions;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResult;
import androidx.appcompat.app.AlertDialog;
import androidx.core.content.FileProvider;
import androidx.exifinterface.media.ExifInterface;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.util.*;

/** Selected photos only. Never requests device GPS or broad gallery access. */
@CapacitorPlugin(name="MoveNotesMedia", permissions={
    @Permission(alias="mediaLocation",strings={Manifest.permission.ACCESS_MEDIA_LOCATION})
})
public class MoveNotesMediaPlugin extends Plugin {
    private static final long MAX_BYTES=64L*1024*1024;
    private File cameraFile;
    private static volatile boolean picking=false;
    static boolean isPickerActive(){return picking;}

    @Override public void load(){
        File[] stale=getContext().getCacheDir().listFiles((dir,name)->name.startsWith("movenotes-media-"));
        if(stale!=null)for(File file:stale)if(file.lastModified()<System.currentTimeMillis()-86400000L)file.delete();
    }

    @PluginMethod public void pick(PluginCall call) {
        if(picking){call.reject("Finish the current photo selection first.");return;}
        String source=call.getString("source","library");
        if(!source.equals("library")&&!source.equals("camera")){call.reject("Unknown photo source.");return;}
        int limit=call.getInt("maxCount",1);
        if(limit<1||limit>5){call.reject("You can attach up to five photos.");return;}
        picking=true;
        // New system Photo Picker asks about location per selection. Older
        // Android versions use selected-file grants plus media-location consent.
        if(source.equals("library")&&!locationPickerAvailable()&&Build.VERSION.SDK_INT>=29&&getPermissionState("mediaLocation")!=PermissionState.GRANTED){
            getActivity().runOnUiThread(()->new AlertDialog.Builder(getActivity())
                .setTitle("Photo locations (optional)")
                .setMessage("MoveNotes can use the location already saved in your selected photos to remember where they were taken. Your phone's current location is not used. You can upload photos without including their locations.")
                .setPositiveButton("Include locations",(dialog,which)->requestPermissionForAlias("mediaLocation",call,"locationPermissionResult"))
                .setNegativeButton("Photos only",(dialog,which)->{call.getData().put("_gpsDeclined",true);launch(call);})
                .setOnCancelListener(dialog->{picking=false;call.reject("Image selection cancelled.","CANCELLED");})
                .show());
        }else launch(call);
    }

    @PermissionCallback private void locationPermissionResult(PluginCall call){launch(call);}

    private boolean locationPickerAvailable(){return Build.VERSION.SDK_INT>=33&&SdkExtensions.getExtensionVersion(Build.VERSION_CODES.TIRAMISU)>=23;}

    private void launch(PluginCall call){
        try{
            if(call.getString("source","library").equals("camera")){
                cameraFile=File.createTempFile("movenotes-media-",".jpg",getContext().getCacheDir());
                Uri uri=FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",cameraFile);
                Intent camera=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                camera.putExtra(MediaStore.EXTRA_OUTPUT,uri);
                camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_READ_URI_PERMISSION);
                camera.setClipData(ClipData.newRawUri("MoveNotes photo",uri));
                startActivityForResult(call,camera,"selected");
            }else{
                Intent intent;
                int limit=call.getInt("maxCount",1);
                if(locationPickerAvailable()){
                    intent=new Intent(MediaStore.ACTION_PICK_IMAGES);
                    intent.setType("image/*");
                    intent.putExtra("android.provider.extra.REQUEST_LOCATION_METADATA_ACCESS",true);
                    if(limit>1)intent.putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX,limit);
                }else{
                    intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("image/*");
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,limit>1);
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                }
                startActivityForResult(call,intent,"selected");
            }
        }catch(Exception e){picking=false;removeCamera();call.reject("Could not open the camera or photo selector. Please try again.");}
    }

    @ActivityCallback private void selected(PluginCall call,ActivityResult result){
        if(call==null){picking=false;removeCamera();return;}
        if(result.getResultCode()!=Activity.RESULT_OK){picking=false;removeCamera();call.reject("Image selection cancelled.","CANCELLED");return;}
        // Copy and EXIF parsing run off the main/UI thread. Returning file URIs,
        // rather than base64, avoids duplicating large images over the bridge.
        getBridge().execute(()->{
            List<File> copies=new ArrayList<>();
            try{
                boolean camera=call.getString("source","library").equals("camera");
                List<Uri> uris=new ArrayList<>();
                if(camera){if(cameraFile==null||cameraFile.length()==0)throw new IOException();uris.add(Uri.fromFile(cameraFile));}
                else{
                    Intent data=result.getData();
                    if(data!=null&&data.getClipData()!=null){for(int i=0;i<data.getClipData().getItemCount();i++)uris.add(data.getClipData().getItemAt(i).getUri());}
                    else if(data!=null&&data.getData()!=null)uris.add(data.getData());
                }
                uris=new ArrayList<>(new LinkedHashSet<>(uris));
                if(uris.isEmpty())throw new IOException();
                if(uris.size()>call.getInt("maxCount",1))throw new IllegalArgumentException("Choose no more than "+call.getInt("maxCount",1)+" photos.");
                JSArray images=new JSArray();
                boolean permission=!call.getBoolean("_gpsDeclined",false)&&(Build.VERSION.SDK_INT<29||getPermissionState("mediaLocation")==PermissionState.GRANTED);
                for(Uri uri:uris){
                    boolean picker=isPickerUri(uri);
                    // Picker-returned bytes reflect its final per-selection consent.
                    boolean mayReadGps=camera||picker||permission;
                    String mime=camera?"image/jpeg":getContext().getContentResolver().getType(uri);
                    String extension=extension(mime);
                    if(extension==null)throw new IllegalArgumentException("Choose a supported photo (JPEG, PNG, WebP, HEIC or GIF).");
                    File file=File.createTempFile("movenotes-media-","."+extension,getContext().getCacheDir());copies.add(file);
                    Uri original=uri;
                    if(!camera&&!picker&&permission&&Build.VERSION.SDK_INT>=29){
                        try{Uri media=MediaStore.getMediaUri(getContext(),uri);if(media!=null)original=MediaStore.setRequireOriginal(media);}catch(Exception ignored){}
                    }
                    try(InputStream in=open(original);OutputStream out=new FileOutputStream(file)){copyBounded(in,out);}
                    catch(SecurityException|UnsupportedOperationException e){try(InputStream in=open(uri);OutputStream out=new FileOutputStream(file)){copyBounded(in,out);}}
                    JSObject item=new JSObject();item.put("uri",Uri.fromFile(file).toString());item.put("name",file.getName());item.put("mimeType",mime);item.put("metadataAllowed",mayReadGps);
                    if(mayReadGps){
                        try{double[] gps=new ExifInterface(file).getLatLong();if(gps!=null&&validGps(gps[0],gps[1])){JSObject coords=new JSObject();coords.put("lat",gps[0]);coords.put("lng",gps[1]);item.put("coords",coords);}}catch(Exception ignored){}
                    }
                    images.put(item);
                }
                JSObject response=new JSObject();response.put("images",images);call.resolve(response);
            }catch(Exception e){for(File file:copies)file.delete();call.reject(e instanceof IllegalArgumentException?e.getMessage():"Could not read this photo. Your activity is still saved; please try another photo.");}
            finally{removeCamera();picking=false;}
        });
    }

    private InputStream open(Uri uri)throws IOException{return "file".equals(uri.getScheme())?new FileInputStream(uri.getPath()):getContext().getContentResolver().openInputStream(uri);}
    private static void copyBounded(InputStream in,OutputStream out)throws IOException{if(in==null)throw new IOException();byte[] buffer=new byte[65536];long bytes=0;int n;while((n=in.read(buffer))!=-1){bytes+=n;if(bytes>MAX_BYTES)throw new IOException("Photo is too large");out.write(buffer,0,n);}if(bytes==0)throw new IOException();}
    static boolean validGps(double lat,double lng){return Double.isFinite(lat)&&Double.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180&&!(lat==0&&lng==0);}
    static boolean isPickerUri(Uri uri){return uri.getPath()!=null&&(uri.getPath().startsWith("/picker/")||uri.getPath().startsWith("/picker_get_content/"));}
    static String extension(String mime){if(mime==null)return null;switch(mime.toLowerCase(Locale.ROOT)){case "image/jpeg":return "jpg";case "image/png":return "png";case "image/webp":return "webp";case "image/heic":return "heic";case "image/heif":return "heif";case "image/gif":return "gif";case "image/avif":return "avif";default:return null;}}
    private void removeCamera(){if(cameraFile!=null){cameraFile.delete();cameraFile=null;}}
    @PluginMethod public void release(PluginCall call){
        try{JSArray paths=call.getArray("uris",new JSArray());for(int i=0;i<paths.length();i++){File f=new File(Uri.parse(paths.getString(i)).getPath()).getCanonicalFile();if(f.getParentFile().equals(getContext().getCacheDir().getCanonicalFile())&&f.getName().startsWith("movenotes-media-"))f.delete();}call.resolve();}catch(Exception e){call.reject("Could not clear temporary photo files.");}
    }
}
