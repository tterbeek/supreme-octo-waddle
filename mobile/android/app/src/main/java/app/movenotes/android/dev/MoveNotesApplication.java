package app.movenotes.android.dev;

import android.app.Application;
import android.content.ComponentCallbacks2;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.util.Log;
import android.webkit.WebView;

/** Narrow compatibility guard for the preview emulator's bundled WebView.
 * Do not suppress actual memory-pressure/critical signals, or affect other
 * Android/WebView versions. Active camera/picker work retains the existing PWA.
 */
public class MoveNotesApplication extends Application {
    @Override public void onTrimMemory(int level) {
        boolean backgroundNotice=level==ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN||level==ComponentCallbacks2.TRIM_MEMORY_BACKGROUND;
        if(backgroundNotice&&MoveNotesMediaPlugin.isPickerActive()&&Build.VERSION.SDK_INT==37){
            PackageInfo provider=WebView.getCurrentWebViewPackage();
            if(provider!=null&&"145.0.7632.45".equals(provider.versionName)){
                Log.i("MoveNotesMedia","Deferred background trim during active media selection: "+level);
                return;
            }
        }
        super.onTrimMemory(level);
    }
}
