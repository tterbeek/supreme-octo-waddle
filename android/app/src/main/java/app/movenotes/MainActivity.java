package app.movenotes;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int MEDIA_LOCATION_REQUEST_CODE = 1201;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestPhotoMetadataPermissionsIfNeeded();
    }

    private void requestPhotoMetadataPermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return;
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_MEDIA_LOCATION)
            == PackageManager.PERMISSION_GRANTED) {
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(
                this,
                new String[] {
                    Manifest.permission.READ_MEDIA_IMAGES,
                    Manifest.permission.ACCESS_MEDIA_LOCATION
                },
                MEDIA_LOCATION_REQUEST_CODE
            );
            return;
        }

        ActivityCompat.requestPermissions(
            this,
            new String[] {
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.ACCESS_MEDIA_LOCATION
            },
            MEDIA_LOCATION_REQUEST_CODE
        );
    }
}
